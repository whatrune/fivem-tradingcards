fx_version 'cerulean'
game 'gta5'

author 'Trading Cards ULTIMATE'
description 'Trading Cards System (Admin Tablet + Binder Album + Pack Peel + Send + NEW badges)'
version '3.2.2'

ui_page 'html/index.html'

files {
  'html/index.html',
  'html/style.css',
  'html/app.js',
  'html/sounds/*.*',
  'html/images/*.*'
}

shared_scripts {
  'shared/config.lua'
}

server_scripts {
  '@oxmysql/lib/MySQL.lua',
  'server/main.lua'
}

client_scripts {
  'client/main.lua',
  'client/ox_bridge.lua'
}
