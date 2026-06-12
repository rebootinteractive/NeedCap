import type { LevelData } from '../shared/types';
import { ALL_LEVELS } from '../levels';
import { loadCustomLevels, deleteCustomLevel } from './storage';

export interface MenuCallbacks {
  onPlay: (level: LevelData) => void;
  onEdit: (level: LevelData) => void;
  onCreate: () => void;
}

export class MainMenu {
  private root: HTMLDivElement;

  constructor(private parent: HTMLElement, private cb: MenuCallbacks) {
    this.root = document.createElement('div');
    this.root.className = 'menu';
    parent.appendChild(this.root);
    this.render();
  }

  private meta(l: LevelData): string {
    const boxes = l.queues.reduce((a, q) => a + q.boxes.length, 0);
    return `${l.queues.length} queues · ${l.deckSlots} deck slots · ${boxes} boxes`;
  }

  private render() {
    const custom = loadCustomLevels();
    this.root.innerHTML = '';

    const title = document.createElement('div');
    title.className = 'menu-title';
    title.textContent = 'NeedCap';
    const sub = document.createElement('div');
    sub.className = 'menu-sub';
    sub.textContent = 'Fill the boxes, seal them with a cap, clear every queue.';
    this.root.append(title, sub);

    const lbl = document.createElement('div');
    lbl.className = 'menu-section-label';
    lbl.textContent = 'Levels';
    this.root.appendChild(lbl);

    const list = document.createElement('div');
    list.className = 'level-list';
    for (const l of ALL_LEVELS) list.appendChild(this.levelCard(l, false));
    this.root.appendChild(list);

    const youLbl = document.createElement('div');
    youLbl.className = 'menu-section-label';
    youLbl.textContent = `Your Levels (${custom.length})`;
    this.root.appendChild(youLbl);

    if (custom.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'menu-sub';
      empty.style.opacity = '0.6';
      empty.textContent = 'No custom levels yet — create one in the editor.';
      this.root.appendChild(empty);
    } else {
      const clist = document.createElement('div');
      clist.className = 'level-list';
      for (const l of custom) clist.appendChild(this.levelCard(l, true));
      this.root.appendChild(clist);
    }

    const footer = document.createElement('div');
    footer.className = 'menu-footer';
    const create = document.createElement('button');
    create.className = 'btn';
    create.style.width = '100%';
    create.textContent = '+ Create New Level';
    create.addEventListener('click', () => this.cb.onCreate());
    footer.appendChild(create);
    this.root.appendChild(footer);
  }

  private levelCard(l: LevelData, custom: boolean): HTMLElement {
    const card = document.createElement('div');
    card.className = 'level-card';

    const left = document.createElement('div');
    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = l.name;
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = this.meta(l);
    left.append(name, meta);
    card.appendChild(left);
    card.addEventListener('click', () => this.cb.onPlay(l));

    const right = document.createElement('div');
    right.style.display = 'flex';
    right.style.alignItems = 'center';
    right.style.gap = '4px';
    if (custom) {
      const edit = document.createElement('button');
      edit.className = 'btn ghost small';
      edit.textContent = 'Edit';
      edit.addEventListener('click', (e) => {
        e.stopPropagation();
        this.cb.onEdit(l);
      });
      const del = document.createElement('button');
      del.className = 'delete';
      del.textContent = '🗑';
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteCustomLevel(l.id);
        this.render();
      });
      right.append(edit, del);
    } else {
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = 'PLAY';
      right.appendChild(badge);
    }
    card.appendChild(right);
    return card;
  }

  dispose() {
    this.root.remove();
  }
}
