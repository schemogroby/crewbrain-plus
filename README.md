# Zeiterfassung Plus für CrewBrain

Chrome-Erweiterung für eine schnellere Zeiterfassung in CrewBrain. Sie ändert nur die Oberfläche und speichert nie selbst. Gespeichert wird wie gewohnt über „Zeit ändern“ und „Speichern“.

## Funktionen

- **Rasteransicht (Tag):** Anwesenheit (grün), Pausen (rot) und noch nicht verbuchte Anwesenheitszeit (orange) liegen als Hintergrund in allen Aufgaben-Zeilen. Oben steht eine Zusammenfassung mit Anwesenheit, Pause, verbuchter Zeit und offenen Lücken.
- **Zoom:** 0–24, 6–20 (Standard), „Anwesenheit“ (automatisch) sowie − / +. Scrollen geht seitlich mit Trackpad oder ⇧ + Mausrad, die Spalte mit den Aufgabennamen bleibt stehen.
- **Bündig setzen:** Der Dialog eines Balkens ist etwas größer. Unter Start und Ende steht jeweils der wahrscheinlichste Zeitpunkt (Start: Ende des vorigen Jobs, Pausen-Ende oder Anwesenheitsbeginn; Ende: Start des nächsten Jobs, Pause oder Anwesenheitsende) sowie −15 / +15, die auf die Viertelstunde einrasten. Darüber „Lücke füllen“. Bei Unabhängigen Zeiten beginnt die Anwesenheit am Pausen-Ende, eine Pause endet am Beginn des nächsten Anwesenheits-Blocks.
- **Tätigkeit vervollständigen:** Das Feld „Tätigkeit“ schlägt deine letzten 20 Einträge vor, dazu die Tätigkeiten des offenen Tages und der fünf Arbeitstage davor. Beim Tippen grenzt sich die Liste ein.
- **Neuer Balken bündig:** Klickst du in eine Aufgaben-Zeile, legt CrewBrain eine volle Stunde an. Ragt die Stunde über Anwesenheitsbeginn, -ende, eine Pause oder einen schon eingetragenen Job hinaus, wird sie dort gekappt, schon in der Vorschau „Neu…“. Der neue Job schließt also direkt an den vorigen an und endet am Start des nächsten.
- **Aufgabensuche:** Wortteile in beliebiger Reihenfolge über Event, Bereich und Aufgabe, zum Beispiel `arena meet`. ↑↓ wählen aus, Enter übernimmt, zuletzt genutzte Aufgaben stehen als Knöpfe darüber. Aufgaben, die CrewBrain nicht in der Startliste zeigt (z. B. „… / Kommunikation & Grafik / KV“), werden im Hintergrund mitgesucht und erscheinen unter „Weitere Treffer“. Dafür muss mindestens ein Suchwort im letzten Teil des Namens stehen: `nature kv` findet „NATURE ONE / … / KV“, `nature grafik` nur den Bereich „NATURE ONE / Kommunikation & Grafik“.
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
