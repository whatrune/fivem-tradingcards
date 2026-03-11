local QBCore = exports['qb-core']:GetCoreObject()
RollCard = RollCard or function()
  return nil
end
local RollCard -- forward declaration
-- =========================================================
-- TradingCards: ox_inventory_fork compatibility (USE exports/events)
-- - Keeps QB CreateUseableItem working
-- - Adds exports so ox_inventory_fork items.lua can call tradingcards.usePack/openBinder
-- - Adds server events as an alternative hook
-- =========================================================
local function RemovePackItem(src, itemName, amount)
    amount = amount or 1

    if GetResourceState('ox_inventory_fork') == 'started' then
        -- ox_inventory_fork server export
        local ok = exports.ox_inventory_fork:RemoveItem(src, itemName, amount)
        if ok == nil then ok = true end
        return ok
    end

    local Player = QBCore.Functions.GetPlayer(src)
    if not Player then return false end
    return Player.Functions.RemoveItem(itemName, amount)
end

local function UseCardPack(src)
    local Player = QBCore.Functions.GetPlayer(src)
    if not Player then return end

    if not RemovePackItem(src, Config.Items.CardPack, 1) then return end

    local card = RollCard()
    if not card then
        TriggerClientEvent("QBCore:Notify", src, "カードが登録されていません（管理画面で追加してください）", "error")
        return
    end

    -- Aggregated ownership: one row per (citizenid, card_id)
    -- On acquire: count++ and mark NEW
    MySQL.insert.await([[
        INSERT INTO player_cards (citizenid, card_id, count, is_new)
        VALUES (?, ?, 1, 1)
        ON DUPLICATE KEY UPDATE
          count = count + 1
    ]], { Player.PlayerData.citizenid, card.card_id })

    TriggerClientEvent("cards:client:openPack", src, card)
end

local function OpenBinder(src)
    TriggerClientEvent("cards:client:openBinder", src)
end

-- Exports for ox_inventory_fork items.lua (server.export = 'tradingcards.usePack')
exports('usePack', function(src)
    UseCardPack(src or source)
end)

exports('openBinder', function(src)
    OpenBinder(src or source)
end)

-- Events (alternative hook)
RegisterNetEvent('tradingcards:server:openBinder', function()
    OpenBinder(source)
end)

local QBCore = exports['qb-core']:GetCoreObject()

local function IsCardAdmin(src)
  return IsPlayerAceAllowed(src, Config.AcePermission)
end

local function NowSQL()
  return os.date('%Y-%m-%d %H:%M:%S')
end

local DEFAULT_RARITY_WEIGHTS = {
  R = 9548,
  SR = 400,
  SSR = 50,
  UR = 2
}

local function NormalizeRarityKey(v)
  local key = string.upper(tostring(v or 'R'))
  if key ~= 'R' and key ~= 'SR' and key ~= 'SSR' and key ~= 'UR' then return 'R' end
  return key
end

local function GetRarityWeights()
  local rows = MySQL.query.await("SELECT rarity, weight FROM card_rarity_weights") or {}
  local out = {}
  for rarity, weight in pairs(DEFAULT_RARITY_WEIGHTS) do
    out[rarity] = tonumber(weight) or 0
  end
  for _, row in ipairs(rows) do
    local rarity = NormalizeRarityKey(row.rarity)
    out[rarity] = math.max(0, tonumber(row.weight) or 0)
  end
  return out
end

local function SeedRarityWeights()
  for rarity, weight in pairs(DEFAULT_RARITY_WEIGHTS) do
    MySQL.insert.await([[
      INSERT INTO card_rarity_weights (rarity, weight)
      VALUES (?, ?)
      ON DUPLICATE KEY UPDATE weight = weight
    ]], { rarity, tonumber(weight) or 0 })
  end
end

local function EnsureSchema()
  MySQL.query([[
    CREATE TABLE IF NOT EXISTS card_master (
      card_id VARCHAR(50) PRIMARY KEY,
      label VARCHAR(100),
      rarity VARCHAR(10),
      image_url TEXT,
      weight INT,
      page INT DEFAULT 1,
      slot INT DEFAULT 1,
      is_active BOOLEAN DEFAULT TRUE,
      is_limited BOOLEAN DEFAULT FALSE,
      start_date DATETIME NULL,
      end_date DATETIME NULL
    )
  ]])

  MySQL.query([[
    CREATE TABLE IF NOT EXISTS player_cards (
      citizenid VARCHAR(50) NOT NULL,
      card_id VARCHAR(50) NOT NULL,
      count INT NOT NULL DEFAULT 0,
      is_new TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (citizenid, card_id),
      INDEX idx_citizenid (citizenid),
      INDEX idx_card_id (card_id)
    )
  ]])

  MySQL.query([[
    CREATE TABLE IF NOT EXISTS card_rarity_weights (
      rarity VARCHAR(10) PRIMARY KEY,
      weight INT NOT NULL DEFAULT 0
    )
  ]])
end

MySQL.ready(function()
  EnsureSchema()
  SeedRarityWeights()
end)

RollCard = function()
  local now = NowSQL()
  local cards = MySQL.query.await([[
    SELECT * FROM card_master
    WHERE is_active = 1
      AND (
        is_limited = 0
        OR (is_limited = 1 AND (start_date IS NULL OR start_date <= ?) AND (end_date IS NULL OR end_date >= ?))
      )
  ]], {now, now})

  if not cards or #cards == 0 then return nil end

  local buckets = { R = {}, SR = {}, SSR = {}, UR = {} }
  for _, card in ipairs(cards) do
    local rarity = NormalizeRarityKey(card.rarity)
    table.insert(buckets[rarity], card)
  end

  local rarityWeights = GetRarityWeights()
  local totalRarityWeight = 0
  local availableRarities = {}
  for rarity, list in pairs(buckets) do
    if #list > 0 then
      local weight = math.max(0, tonumber(rarityWeights[rarity]) or 0)
      if weight > 0 then
        totalRarityWeight = totalRarityWeight + weight
        table.insert(availableRarities, { rarity = rarity, weight = weight, cards = list })
      end
    end
  end

  if totalRarityWeight <= 0 then return nil end

  local rarityRoll = math.random(1, totalRarityWeight)
  local raritySum = 0
  local chosenBucket = nil
  for _, entry in ipairs(availableRarities) do
    raritySum = raritySum + entry.weight
    if rarityRoll <= raritySum then
      chosenBucket = entry
      break
    end
  end
  if not chosenBucket then chosenBucket = availableRarities[#availableRarities] end
  if not chosenBucket or not chosenBucket.cards or #chosenBucket.cards == 0 then return nil end

  local totalCardWeight = 0
  for _, card in ipairs(chosenBucket.cards) do
    totalCardWeight = totalCardWeight + math.max(0, tonumber(card.weight) or 0)
  end
  if totalCardWeight <= 0 then return chosenBucket.cards[1] end

  local cardRoll = math.random(1, totalCardWeight)
  local cardSum = 0
  for _, card in ipairs(chosenBucket.cards) do
    cardSum = cardSum + math.max(0, tonumber(card.weight) or 0)
    if cardRoll <= cardSum then return card end
  end
  return chosenBucket.cards[#chosenBucket.cards]
end

QBCore.Functions.CreateUseableItem(Config.Items.CardPack, function(source)
  UseCardPack(source)
end)

QBCore.Functions.CreateUseableItem(Config.Items.CardFinder, function(source)
  OpenBinder(source)
end)

RegisterNetEvent("cards:server:getAlbum", function()
  local src = source
  local Player = QBCore.Functions.GetPlayer(src)
  if not Player then return end

  local allCards = MySQL.query.await("SELECT * FROM card_master ORDER BY page ASC, slot ASC")
  local owned = MySQL.query.await([[
    SELECT card_id, count, is_new
    FROM player_cards
    WHERE citizenid = ?
  ]], { Player.PlayerData.citizenid })

  TriggerClientEvent("cards:client:albumData", src, allCards, owned)
end)

RegisterNetEvent("cards:server:clearNew", function(cardId)
  local src = source
  local Player = QBCore.Functions.GetPlayer(src)
  if not Player then return end
  MySQL.update.await([[
    UPDATE player_cards SET is_new = 0
    WHERE citizenid = ? AND card_id = ?
  ]], { Player.PlayerData.citizenid, cardId })
end)

RegisterNetEvent("cards:server:sendCard", function(targetId, cardId)
  local src = source
  local Player = QBCore.Functions.GetPlayer(src)
  local Target = QBCore.Functions.GetPlayer(tonumber(targetId))
  if not Player then return end
  if not Target then
    TriggerClientEvent('tradingcards:client:uiToast', src, '指定したIDのプレイヤーがオフラインです', 'error')
    return
  end

  local sender = MySQL.single.await([[ 
    SELECT count FROM player_cards WHERE citizenid = ? AND card_id = ?
  ]], { Player.PlayerData.citizenid, cardId })

  if not sender or (tonumber(sender.count) or 0) <= 0 then
    TriggerClientEvent("QBCore:Notify", src, "そのカードを持っていません", "error")
    return
  end

  local receiver = MySQL.single.await([[ 
    SELECT count FROM player_cards WHERE citizenid = ? AND card_id = ?
  ]], { Target.PlayerData.citizenid, cardId })
  local already = (receiver and (tonumber(receiver.count) or 0) > 0) and 1 or 0

  -- Remove 1 from sender
  local dec = MySQL.update.await([[ 
    UPDATE player_cards
    SET count = count - 1
    WHERE citizenid = ? AND card_id = ? AND count > 0
  ]], { Player.PlayerData.citizenid, cardId })

  if not dec or dec <= 0 then
    TriggerClientEvent('tradingcards:client:uiToast', src, '送信に失敗しました', 'error')
    return
  end

  -- Clean up sender row if count hits 0
  MySQL.update.await([[ 
    DELETE FROM player_cards
    WHERE citizenid = ? AND card_id = ? AND count <= 0
  ]], { Player.PlayerData.citizenid, cardId })

  -- Add 1 to receiver and mark NEW
  MySQL.insert.await([[ 
    INSERT INTO player_cards (citizenid, card_id, count, is_new)
    VALUES (?, ?, 1, 1)
    ON DUPLICATE KEY UPDATE
      count = count + 1
  ]], { Target.PlayerData.citizenid, cardId })

  do
    TriggerClientEvent('tradingcards:client:uiToast', src, '送信しました', 'success')
    TriggerClientEvent("cards:client:cardReceived", tonumber(targetId), cardId, (already == 0))
  end
end)

RegisterCommand("cardadmin", function(source)
  if source == 0 then return end
  if not IsCardAdmin(source) then
    TriggerClientEvent("QBCore:Notify", source, "権限がありません", "error")
    return
  end
  TriggerClientEvent("cards:client:openAdmin", source)
end)

RegisterNetEvent("cards:server:adminGetCards", function()
  local src = source
  if not IsCardAdmin(src) then return end
  local cards = MySQL.query.await("SELECT * FROM card_master ORDER BY page ASC, slot ASC")
  TriggerClientEvent("cards:client:adminCards", src, cards)
end)

RegisterNetEvent("cards:server:adminGetRarityWeights", function()
  local src = source
  if not IsCardAdmin(src) then return end
  TriggerClientEvent("cards:client:adminRarityWeights", src, GetRarityWeights())
end)

RegisterNetEvent("cards:server:adminSaveRarityWeights", function(data)
  local src = source
  if not IsCardAdmin(src) then return end
  if type(data) ~= 'table' then return end

  local updates = {}
  for rarity, _ in pairs(DEFAULT_RARITY_WEIGHTS) do
    local value = math.floor(math.max(0, tonumber(data[rarity]) or tonumber(data[string.lower(rarity)]) or 0))
    updates[rarity] = value
  end

  local total = 0
  for _, weight in pairs(updates) do total = total + weight end
  if total <= 0 then
    TriggerClientEvent('tradingcards:client:uiToast', src, '排出率の合計は 1 以上にしてください', 'error')
    return
  end

  for rarity, weight in pairs(updates) do
    MySQL.insert.await([[
      INSERT INTO card_rarity_weights (rarity, weight)
      VALUES (?, ?)
      ON DUPLICATE KEY UPDATE weight = VALUES(weight)
    ]], { rarity, weight })
  end

  TriggerClientEvent('tradingcards:client:uiToast', src, '排出率を保存しました', 'success')
  TriggerClientEvent("cards:client:adminRarityWeights", src, GetRarityWeights())
end)

RegisterNetEvent("cards:server:adminUpdateCard", function(data)
  local src = source
  if not IsCardAdmin(src) then return end
  if type(data) ~= "table" then return end
  if not data.card_id or data.card_id == "" then
    TriggerClientEvent('tradingcards:client:uiToast', src, 'card_id が不正です', 'error')
    return
  end

  -- only update editable fields (card_id itself is the key)
  MySQL.update.await([[
    UPDATE card_master
    SET label = ?, rarity = ?, weight = ?, image_url = ?, is_limited = ?, start_date = ?, end_date = ?
    WHERE card_id = ?
  ]], {
    data.label, data.rarity, data.weight, data.image_url,
    (data.is_limited and 1 or 0),
    (data.start_date ~= "" and data.start_date or nil),
    (data.end_date ~= "" and data.end_date or nil),
    data.card_id
  })

  TriggerClientEvent('tradingcards:client:uiToast', src, 'カードを更新しました', 'success')
  local cards = MySQL.query.await("SELECT * FROM card_master ORDER BY page ASC, slot ASC")
  TriggerClientEvent("cards:client:adminCards", src, cards)
end)

RegisterNetEvent("cards:server:adminAddCard", function(data)
  local src = source
  if not IsCardAdmin(src) then return end
  if type(data) ~= "table" then return end

  local exists = MySQL.scalar.await("SELECT COUNT(*) FROM card_master WHERE card_id = ?", {data.card_id}) or 0
  if exists > 0 then
    TriggerClientEvent("QBCore:Notify", src, "card_id が既に存在します", "error")
    return
  end

  MySQL.insert.await([[
    INSERT INTO card_master
      (card_id, label, rarity, image_url, weight, page, slot, is_active, is_limited, start_date, end_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
  ]], {
    data.card_id, data.label, data.rarity, data.image_url,
    tonumber(data.weight) or 0, tonumber(data.page) or 1, tonumber(data.slot) or 1,
    data.is_limited and 1 or 0,
    (data.start_date and data.start_date ~= "" and data.start_date) or nil,
    (data.end_date and data.end_date ~= "" and data.end_date) or nil
  })

  TriggerClientEvent('tradingcards:client:uiToast', src, 'カードを登録しました', 'success')
  local cards = MySQL.query.await("SELECT * FROM card_master ORDER BY page ASC, slot ASC")
  TriggerClientEvent("cards:client:adminCards", src, cards)
  TriggerClientEvent("cards:client:adminRarityWeights", src, GetRarityWeights())
end)

RegisterNetEvent("cards:server:adminDeleteCard", function(cardId)
  local src = source
  if not IsCardAdmin(src) then
    TriggerClientEvent('tradingcards:client:uiToast', src, '権限がありません', 'error')
    return
  end
  cardId = tostring(cardId or ''):gsub('^%s+', ''):gsub('%s+$', '')
  if cardId == '' then
    TriggerClientEvent('tradingcards:client:uiToast', src, 'card_id が不正です', 'error')
    return
  end

  local exists = MySQL.scalar.await("SELECT COUNT(*) FROM card_master WHERE card_id = ?", {cardId}) or 0
  if exists <= 0 then
    TriggerClientEvent('tradingcards:client:uiToast', src, '削除対象のカードが見つかりません', 'error')
    return
  end

  MySQL.update.await("DELETE FROM player_cards WHERE card_id = ?", {cardId})
  local deleted = MySQL.update.await("DELETE FROM card_master WHERE card_id = ?", {cardId}) or 0
  if deleted <= 0 then
    TriggerClientEvent('tradingcards:client:uiToast', src, 'カードを削除できませんでした', 'error')
    return
  end

  TriggerClientEvent('tradingcards:client:uiToast', src, 'カードを削除しました', 'success')
  local cards = MySQL.query.await("SELECT * FROM card_master ORDER BY page ASC, slot ASC")
  TriggerClientEvent("cards:client:adminCards", src, cards)
end)

RegisterNetEvent("cards:server:adminToggleActive", function(cardId)
  local src = source
  if not IsCardAdmin(src) then
    TriggerClientEvent('tradingcards:client:uiToast', src, '権限がありません', 'error')
    return
  end
  cardId = tostring(cardId or ''):gsub('^%s+', ''):gsub('%s+$', '')
  if cardId == '' then
    TriggerClientEvent('tradingcards:client:uiToast', src, 'card_id が不正です', 'error')
    return
  end

  -- Atomic toggle (reliable)
  local changed = MySQL.update.await(
    "UPDATE card_master SET is_active = CASE WHEN is_active = 1 THEN 0 ELSE 1 END WHERE card_id = ?",
    {cardId}
  ) or 0

  if changed < 1 then
    TriggerClientEvent('tradingcards:client:uiToast', src, '更新できませんでした（対象が見つからない / DBエラー）', 'error')
    return
  end

  -- Read final state for accurate toast (fallback to generic if nil)
  local curVal = MySQL.scalar.await("SELECT is_active FROM card_master WHERE card_id = ?", {cardId})
  local cur = tonumber(curVal)
  if cur == 1 then
    TriggerClientEvent('tradingcards:client:uiToast', src, 'カードを有効化しました', 'success')
  elseif cur == 0 then
    TriggerClientEvent('tradingcards:client:uiToast', src, 'カードを無効化しました', 'success')
  else
    TriggerClientEvent('tradingcards:client:uiToast', src, '状態を更新しました', 'success')
  end

  local cards = MySQL.query.await("SELECT * FROM card_master ORDER BY page ASC, slot ASC")
  TriggerClientEvent("cards:client:adminCards", src, cards)
end)




RegisterNetEvent("cards:server:adminGivePack", function(targetId, amount)
  local src = source
  if not IsCardAdmin(src) then return end
  local targetNum = tonumber(targetId)
  local giveAmount = math.max(1, tonumber(amount) or 1)
  local Target = QBCore.Functions.GetPlayer(targetNum)
  if not Target then
    TriggerClientEvent('tradingcards:client:uiToast', src, '指定したプレイヤーが見つかりません', 'error')
    return
  end

  local ok = Target.Functions.AddItem(Config.Items.CardPack, giveAmount)
  if ok == false then
    TriggerClientEvent('tradingcards:client:uiToast', src, 'カードパックの配布に失敗しました', 'error')
    return
  end

  TriggerClientEvent('tradingcards:client:uiToast', src, ('カードパックを %s 個配布しました'):format(giveAmount), 'success')
end)


RegisterNetEvent("cards:server:adminGiveFinder", function(targetId)
  local src = source
  if not IsCardAdmin(src) then return end
  local targetNum = tonumber(targetId)
  local Target = QBCore.Functions.GetPlayer(targetNum)
  if not Target then
    TriggerClientEvent('tradingcards:client:uiToast', src, '指定したプレイヤーが見つかりません', 'error')
    return
  end

  local ok = Target.Functions.AddItem(Config.Items.CardFinder, 1)
  if ok == false then
    TriggerClientEvent('tradingcards:client:uiToast', src, 'カードファインダーの配布に失敗しました', 'error')
    return
  end

  TriggerClientEvent('tradingcards:client:uiToast', src, 'カードファインダーを配布しました', 'success')
end)

RegisterNetEvent('tradingcards:server:usePack', function()
  local src = source
  UseCardPack(src)
end)