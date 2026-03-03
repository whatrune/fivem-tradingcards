QB Trading Cards ULTIMATE v3.2 (CHAR SELECT BLACK SCREEN HARD FIX)

■ 追加対策
- body背景を透明化（NUIが描画されても世界を黒塗りしない）
- Watchdog: LocalPlayer.state.isLoggedIn が false の間、毎秒 ForceCloseUI を送る（キャラ選択中に絶対閉じる）

まずこれで直るはず。もしまだ黒いなら「他リソースがDoScreenFadeOutしたまま」か「別NUIが上に黒幕」。
