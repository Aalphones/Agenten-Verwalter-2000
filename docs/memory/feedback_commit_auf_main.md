---
name: feedback-commit-auf-main
description: Im Verwalter-Projekt wird direkt auf dem Branch main committet und gepusht, ohne Feature-Branch und ohne Rückfrage nach dem Branch.
metadata:
  type: feedback
---

Im Projekt Agenten-Verwalter-2000 gehen Commits direkt auf `main`, danach `git push` auf `main`. Kein Feature-Branch, keine Frage „auf welchen Branch?“.

**Why:** Der Benutzer hat die Rückfrage wiederholt bekommen und ausdrücklich verlangt, sich das zu merken („merk dir das endlich mal“).

**How to apply:** Sobald im Verwalter-Projekt ein Commit ansteht und der Benutzer committen oder pushen sagt: Branch nicht erfragen, auf `main` committen und pushen. Gilt für dieses Projekt, nicht für andere Repositories.
