local QBCore = exports['qb-core']:GetCoreObject()

local binderOpen, adminOpen, packOpen = false, false, false

local function Nui(action, payload)
  payload = payload or {}
  payload.action = action
  SendNUIMessage(payload)
end

local function ForceCloseUI()
  binderOpen = false
  adminOpen  = false
  packOpen   = false
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

-- Admin open
RegisterNetEvent("cards:client:openAdmin", function()
  adminOpen = true
  SetNuiFocus(true, true)
  Nui("openAdmin")
  TriggerServerEvent("cards:server:adminGetCards")
end)

RegisterNetEvent("cards:client:adminCards", function(cards)
  Nui("adminCards", {cards = cards})
end)

RegisterNetEvent("cards:client:adminRefresh", function()
  TriggerServerEvent("cards:server:adminGetCards")
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
  packOpen = true
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
RegisterNUICallback("adminToggleActive", function(data, cb) TriggerServerEvent("cards:server:adminToggleActive", data.card_id); cb("ok") end)
RegisterNUICallback("adminGivePack", function(data, cb) TriggerServerEvent("cards:server:adminGivePack", data.targetId, data.amount); cb("ok") end)
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

RegisterNetEvent('tradingcards:openBinder', function()
  TriggerEvent('cards:client:openBinder')
end)

RegisterNetEvent('tradingcards:usePack', function()
  -- サーバー側の「パック使用処理」を呼ぶのが理想
  -- いまの実装が QBCore CreateUseableItem 前提なら、ここでサーバーイベントに寄せる
  TriggerServerEvent('tradingcards:server:usePack')
end)

-- ESC close
CreateThread(function()
  while true do
    Wait(0)
    if (binderOpen or adminOpen or packOpen) and IsControlJustPressed(0, 322) then
      ForceCloseUI()
    end
  end
end)
