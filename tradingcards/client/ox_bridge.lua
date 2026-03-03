exports('usePackClient', function(...)
  print('[tradingcards] usePackClient CALLED') -- ←追加
  TriggerServerEvent('tradingcards:server:usePack')
end)

exports('openBinderClient', function(...)
  print('[tradingcards] openBinderClient CALLED') -- 任意
  TriggerEvent('cards:client:openBinder')
end)