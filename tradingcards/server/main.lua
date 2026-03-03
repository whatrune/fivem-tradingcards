local QBCore = exports['qb-core']:GetCoreObject()
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

    local uid = tostring(math.random(100000, 999999)) .. tostring(os.time())

    MySQL.insert.await([[
        INSERT INTO player_cards (citizenid, card_uid, card_id, is_new)
        VALUES (?, ?, ?, 1)
    ]], { Player.PlayerData.citizenid, uid, card.card_id })

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
      id INT AUTO_INCREMENT PRIMARY KEY,
      citizenid VARCHAR(50),
      card_uid VARCHAR(100),
      card_id VARCHAR(50),
      is_new BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  ]])
end

MySQL.ready(function()
  EnsureSchema()
  print("^2[TradingCards] Schema checked/created.^0")
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
  local total = 0
  for _, c in pairs(cards) do total = total + (tonumber(c.weight) or 0) end
  if total <= 0 then return nil end

  local r = math.random(1, total)
  local sum = 0
  for _, c in pairs(cards) do
    sum = sum + (tonumber(c.weight) or 0)
    if r <= sum then return c end
  end
  return cards[#cards]
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
    SELECT card_id, COUNT(*) AS count, MAX(is_new) AS is_new
    FROM player_cards
    WHERE citizenid = ?
    GROUP BY card_id
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
  if not Player or not Target then return end

  local already = MySQL.scalar.await([[
    SELECT COUNT(*) FROM player_cards WHERE citizenid = ? AND card_id = ?
  ]], { Target.PlayerData.citizenid, cardId }) or 0

  local row = MySQL.single.await([[
    SELECT card_uid FROM player_cards
    WHERE citizenid = ? AND card_id = ?
    ORDER BY created_at ASC
    LIMIT 1
  ]], { Player.PlayerData.citizenid, cardId })

  if not row then
    TriggerClientEvent("QBCore:Notify", src, "そのカードを持っていません", "error")
    return
  end

  local updated = MySQL.update.await([[
    UPDATE player_cards
    SET citizenid = ?, is_new = 1
    WHERE card_uid = ? AND citizenid = ?
  ]], { Target.PlayerData.citizenid, row.card_uid, Player.PlayerData.citizenid })

  if updated and updated > 0 then
    TriggerClientEvent("QBCore:Notify", src, "送信しました", "success")
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

  TriggerClientEvent("cards:client:adminRefresh", src)
end)

RegisterNetEvent("cards:server:adminToggleActive", function(cardId)
  local src = source
  if not IsCardAdmin(src) then return end
  local row = MySQL.single.await("SELECT is_active FROM card_master WHERE card_id = ?", {cardId})
  if not row then return end
  local newState = (row.is_active == 1) and 0 or 1
  MySQL.update.await("UPDATE card_master SET is_active = ? WHERE card_id = ?", {newState, cardId})
  TriggerClientEvent("cards:client:adminRefresh", src)
end)

RegisterNetEvent("cards:server:adminGivePack", function(targetId, amount)
  local src = source
  if not IsCardAdmin(src) then return end
  local Target = QBCore.Functions.GetPlayer(tonumber(targetId))
  if not Target then return end
  Target.Functions.AddItem(Config.Items.CardPack, math.max(1, tonumber(amount) or 1))
end)

RegisterNetEvent('tradingcards:server:usePack', function()
  local src = source
  print(('[tradingcards] server:usePack from %s'):format(src))
  UseCardPack(src)
end)