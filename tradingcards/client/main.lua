local QBCore = exports['qb-core']:GetCoreObject()

local binderOpen, adminOpen = false, false

local function Nui(action, payload)
  payload = payload or {}
  payload.action = action
  SendNUIMessage(payload)
end

local function ForceCloseUI()
  binderOpen = false
  adminOpen = false
  SetNuiFocus(false, false)
  SetNuiFocusKeepInput(false)
  Nui("forceClose")
end

-- Watchdog (SAFE): during character select / not logged in, only force-close if OUR UI is open.
CreateThread(function()
  while true do
    Wait(1000)
    local loggedIn = LocalPlayer and LocalPlayer.state and LocalPlayer.state.isLoggedIn
    if not loggedIn and (binderOpen or adminOpen) then
      ForceCloseUI()
    end
  end
end)

-- Always close on lifecycle transitions
AddEventHandler('onClientResourceStart', function(resName)
  if GetCurrentResourceName() ~= resName then return end
  ForceCloseUI()
end)

AddEventHandler('onResourceStop', function(resName)
  if GetCurrentResourceName() ~= resName then return end
  ForceCloseUI()
end)

RegisterNetEvent('QBCore:Client:OnPlayerLoaded', function()
  ForceCloseUI()
end)

RegisterNetEvent('QBCore:Client:OnPlayerUnload', function()
  ForceCloseUI()
end)

-- Watchdog: during character select / not logged in, keep our NUI forcibly closed.
CreateThread(function()
  while true do
    Wait(1000)
    local loggedIn = LocalPlayer and LocalPlayer.state and LocalPlayer.state.isLoggedIn
    if not loggedIn then
      -- If any other UI is on top, do not steal focus; just ensure ours is not.
      SetNuiFocus(false, false)
      SetNuiFocusKeepInput(false)
      Nui("forceClose")
      binderOpen = false
      adminOpen = false
    end
  end
end)

-- Admin open
RegisterNetEvent("cards:client:openAdmin", function()
  adminOpen = true
  SetNuiFocus(true, true)
  Nui("openAdmin")
  TriggerServerEvent("cards:server:adminGetCards")
  TriggerServerEvent("cards:server:adminGetRarityWeights")
end)

RegisterNetEvent("cards:client:adminCards", function(cards)
  Nui("adminCards", {cards = cards})
end)

RegisterNetEvent("cards:client:adminRarityWeights", function(weights)
  Nui("adminRarityWeights", {weights = weights})
end)

RegisterNetEvent("cards:client:adminRefresh", function()
  TriggerServerEvent("cards:server:adminGetCards")
  TriggerServerEvent("cards:server:adminGetRarityWeights")
end)

-- Binder open (cardfinder)
RegisterNetEvent("cards:client:openBinder", function()
  binderOpen = true
  SetNuiFocus(true, true)
  Nui("openBinder")
  TriggerServerEvent("cards:server:getAlbum")
end)

-- Pack opening (cardpack)
RegisterNetEvent("cards:client:openPack", function(card)
  binderOpen = true
  SetNuiFocus(true, true)
  Nui("openPack", {card = card})
  TriggerServerEvent("cards:server:getAlbum")
end)

-- Album data
RegisterNetEvent("cards:client:albumData", function(allCards, owned)
  Nui("albumData", {allCards = allCards, owned = owned})
end)

-- Received card (send)
RegisterNetEvent("cards:client:cardReceived", function(cardId, isNew)
  Nui("cardReceived", {cardId = cardId, isNew = isNew})
  TriggerServerEvent("cards:server:getAlbum")
end)

-- NUI callbacks
RegisterNUICallback("close", function(_, cb) ForceCloseUI(); cb("ok") end)
RegisterNUICallback("adminAdd", function(data, cb) TriggerServerEvent("cards:server:adminAddCard", data); cb("ok") end)
RegisterNUICallback("adminUpdate", function(data, cb) TriggerServerEvent("cards:server:adminUpdateCard", data); cb("ok") end)
RegisterNUICallback("adminDelete", function(data, cb) TriggerServerEvent("cards:server:adminDeleteCard", data and data.card_id); cb("ok") end)
RegisterNUICallback("adminToggleActive", function(data, cb) TriggerServerEvent("cards:server:adminToggleActive", data.card_id); cb("ok") end)
RegisterNUICallback("adminGivePack", function(data, cb) TriggerServerEvent("cards:server:adminGivePack", data.targetId, data.amount); cb("ok") end)
RegisterNUICallback("adminGiveFinder", function(data, cb) TriggerServerEvent("cards:server:adminGiveFinder", data.targetId); cb("ok") end)
RegisterNUICallback("adminSaveRarityWeights", function(data, cb) TriggerServerEvent("cards:server:adminSaveRarityWeights", data); cb("ok") end)
RegisterNUICallback("sendCard", function(data, cb) TriggerServerEvent("cards:server:sendCard", data.targetId, data.cardId); cb("ok") end)
RegisterNUICallback("clearNew", function(data, cb) TriggerServerEvent("cards:server:clearNew", data.cardId); cb("ok") end)

-- Nearby players (client-side)
RegisterNUICallback("getNearbyPlayers", function(_, cb)
  local coords = GetEntityCoords(PlayerPedId())
  local nearby = {}
  for _, serverId in pairs(QBCore.Functions.GetPlayers()) do
    local player = GetPlayerFromServerId(serverId)
    if player ~= -1 then
      local ped = GetPlayerPed(player)
      if ped ~= PlayerPedId() then
        local c2 = GetEntityCoords(ped)
        if #(coords - c2) <= Config.NearbyRadius then
          table.insert(nearby, { id = serverId })
        end
      end
    end
  end
  cb(nearby)
end)

-- ESC close
CreateThread(function()
  while true do
    Wait(0)
    if (binderOpen or adminOpen) and IsControlJustPressed(0, 322) then
      ForceCloseUI()
    end
  end
end)


-- UI Toast (shown inside NUI, visible above overlay)
RegisterNetEvent('tradingcards:client:uiToast', function(message, kind)
    SendNUIMessage({
        action = 'toast',
        message = message or '',
        kind = kind or 'error'
    })
end)
