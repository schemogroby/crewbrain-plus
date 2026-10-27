# Zeiterfassung Plus für CrewBrain

Chrome-Erweiterung für eine schnellere Zeiterfassung in CrewBrain. Sie ändert nur die Oberfläche und speichert nie selbst. Gespeichert wird wie gewohnt über „Zeit ändern“ und „Speichern“.

## Funktionen

- **Rasteransicht (Tag):** Anwesenheit (grün), Pausen (rot) und noch nicht verbuchte Anwesenheitszeit (orange) liegen als Hintergrund in allen Aufgaben-Zeilen. Oben steht eine Zusammenfassung mit Anwesenheit, Pause, verbuchter Zeit und offenen Lücken.
- **Zoom:** 0–24, 6–18, „Anwesenheit“ (automatisch) sowie − / +. Scrollen geht seitlich mit Trackpad oder ⇧ + Mausrad, die Spalte mit den Aufgabennamen bleibt stehen.
- **Bündig setzen:** Im Dialog eines Balkens gibt es Knöpfe für Start und Ende (Anwesenheitsbeginn und -ende, Pausen, Start und Ende anderer Jobs) sowie „Lücke füllen“.
- **Aufgabensuche:** Wortteile in beliebiger Reihenfolge über Event, Bereich und Aufgabe, zum Beispiel `arena meet`. ↑↓ wählen aus, Enter übernimmt, zuletzt genutzte Aufgaben stehen als Knöpfe darüber.
- **„Heute erfassen“ / „Gestern erfassen“:** Die Knöpfe in der Zeiterfassung öffnen das Raster für heute bzw. den letzten Arbeitstag (montags heißt der Knopf „Freitag erfassen“), auch wenn der Tag in der Vorwoche liegt. Oben muss dafür dein eigener Name ausgewählt sein.
- **„Zukünftige Tage simulieren“** wird automatisch eingeschaltet. Schaltest du es selbst aus, bleibt es in diesem Tab aus.
- **Darkmode:** Die Erweiterung folgt dem hellen bzw. dunklen Farbschema von CrewBrain.

## Installation

**Chrome Web Store:** Version 1.0.0 ist eingereicht und in Prüfung (Stand 27.10.2026). Nach der Freigabe folgt hier der Link, Updates kommen dann automatisch. Bis dahin funktioniert die Installation als entpackte Erweiterung:

1. Repo herunterladen: `git clone …` oder auf GitHub **Code → Download ZIP** und das ZIP entpacken.
2. In Chrome `chrome://extensions` öffnen.
3. Oben rechts den **Entwicklermodus** einschalten.
4. **Entpackte Erweiterung laden** klicken und den Ordner `crewbrain-plus` wählen.
5. CrewBrain neu laden.

Optional als eigene App im Dock: In CrewBrain ⋮ → Streamen, speichern und teilen → **Seite als App installieren**. Die Erweiterung läuft auch dort.

## Updates

```bash
git pull
```

Danach in `chrome://extensions` bei „Zeiterfassung Plus für CrewBrain“ auf den Neu-laden-Pfeil klicken und CrewBrain neu laden. Wer das ZIP benutzt: neues ZIP herunterladen und den alten Ordner ersetzen. Der Ordnerpfad muss dabei gleich bleiben.

## Hinweise

- Die Erweiterung läuft nur auf `*.crewbrain.com`.
- Einstellungen wie Zoom, Overlay und zuletzt genutzte Aufgaben liegen im Browser, pro Person.
- Baut CrewBrain seine Oberfläche um, kann eine Funktion ausfallen. CrewBrain selbst funktioniert dann trotzdem normal weiter.
