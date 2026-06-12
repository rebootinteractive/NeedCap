import type { LevelData } from './shared/types';
import { MainMenu } from './ui/MainMenu';
import { GameApp } from './game/GameApp';
import { EditorApp } from './editor/EditorApp';

const app = document.getElementById('app')!;
let current: { dispose(): void } | undefined;

function clearApp() {
  current?.dispose();
  current = undefined;
}

function showMenu() {
  clearApp();
  current = new MainMenu(app, {
    onPlay: (level) => showGame(level),
    onEdit: (level) => showEditor(level),
    onCreate: () => showEditor(),
  });
}

function showGame(level: LevelData, returnToEditor?: LevelData) {
  clearApp();
  current = new GameApp(app, {
    level,
    onMenu: () => (returnToEditor ? showEditor(returnToEditor) : showMenu()),
    onRestart: () => showGame(level, returnToEditor),
    returnLabel: returnToEditor ? '✎ Editor' : undefined,
  });
}

function showEditor(initial?: LevelData) {
  clearApp();
  current = new EditorApp(app, {
    initial,
    onExit: () => showMenu(),
    onTestPlay: (lv) => showGame(lv, lv),
  });
}

showMenu();
