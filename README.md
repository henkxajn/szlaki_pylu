# Szlaki Pyłu — Web MVP v2.9

Fix: **zakup tlenu i paliwa zwiększa zasoby gracza**.

Zmiany:
- Na rynku, kupno **Paliwo** dodaje `+6 paliwa` do licznika.
- Na rynku, kupno **Tlen (kanister)** dodaje `+6 tlenu` do licznika.
- Te dwa zasoby **nie zajmują ładowni** (są traktowane jak zapas w zbiornikach).
- Sprzedaż paliwa/tlenu działa w paczkach po 6 (nie pozwala zejść poniżej zera).

Wgraj `index.html` i `main.js`. Otwórz stronę z `?v=29` i zrób Ctrl+F5.
