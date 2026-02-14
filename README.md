# Szlaki Pyłu — Web MVP (Phaser 3)

To jest działający prototyp gry heksowej w przeglądarce.

## Jak uruchomić (najprościej)
1. Rozpakuj zip.
2. Otwórz folder w VSCode.
3. Zainstaluj/uruchom rozszerzenie **Live Server**.
4. Kliknij prawym na `index.html` → **Open with Live Server**.

Alternatywnie (Node):
- zainstaluj `http-server` i odpal w katalogu:
  - `npx http-server`

## Sterowanie
- Klikaj sąsiednie heksy, aby się poruszać (koszt: -1 tlen i -1 paliwo).
- Po wejściu na heks pojawia się panel zdarzenia:
  - Handel: kup/sprzedaj
  - Akcja: wydobycie/loot
  - Walka: placeholder ryzyko/nagroda

## Następne kroki
- save/load (localStorage)
- prawdziwa walka turowa
- kontrakty, reputacja, frakcje
- mgła wojny i skaner
