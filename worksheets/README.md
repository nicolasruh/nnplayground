# Online-Arbeitsblätter

Standalone-Arbeitsblätter zur NNPlayground-App. Reines HTML/CSS/JS, kein Server, kein Login: Eingaben bleiben im Browser der Schülerin bzw. des Schülers.

```
worksheets/
  shared/
    worksheet.css      gemeinsames Layout aller Arbeitsblätter
    worksheet.js       gemeinsames Verhalten (Speichern, Screenshots, Navigation, Musterlösungen, Export)
    glossary.json      Fachbegriffe (Kurzdefinition + Verweis auf den Infotext der App)
  ab_smileys/
    content.mjs        Inhalt des Arbeitsblatts (hier schreibst du)
    img/               Abbildungen und Musterlösungs-Screenshots
    index.html         GENERIERT, nicht von Hand ändern
scripts/build-worksheets.mjs
```

Build: `npm run build:worksheets` (läuft auch bei `npm run build` mit). Lokal ansehen: `npm start` und `http://localhost:8080/worksheets/ab_smileys/`. Das Deployment nach GitHub Pages kopiert den Ordner `worksheets/` mit.

## Neues Arbeitsblatt anlegen

1. Ordner `worksheets/ab_<name>/` mit `content.mjs` und `img/` anlegen (am einfachsten `ab_smileys/content.mjs` kopieren).
2. `npm run build:worksheets`. Das Skript baut jeden Ordner mit einer `content.mjs`.
3. `id` in `content.mjs` ist der Speicherschlüssel im Browser. Nicht mehr ändern, sobald SuS damit arbeiten.

## Aufbau von `content.mjs`

- `intro`: Blöcke vor dem ersten Kapitel (Lernziele, Startklar, Begriffe).
- `chapters`: Kapitel mit `id`, `title`, `time`, `blocks`. `numbered: false` für Kapitel ohne Nummer, `optional: true` für Vertiefungen (zählen nicht in den Fortschritt).
- Blocktypen: `text`, `merke`, `hinweis`, `info`, `list`, `table`, `figure`, `heading`, `goals`, `profile`, `task`.
- `task` hat `id`, `text`, optional `media` (Abbildungen im Aufgabenkasten) und `questions`. Ohne `questions` erscheint ein «erledigt»-Haken.
- Aufgaben- und Abbildungsnummern werden automatisch vergeben. Alle `id`s müssen im ganzen Blatt eindeutig sein und sind die Schlüssel der gespeicherten Antworten. Nach dem Einsatz also nicht umbenennen.

Markup in Texten: `**fett**`, `*kursiv*`, `[[term]]` oder `[[term|Anzeigetext]]` (Glossar-Popover, pro Kapitel nur beim ersten Vorkommen; `[[!term]]` erzwingt es), `{{ref:task-id}}` → «Aufgabe 7», `{{fig:figure-id}}` → «Abb. 3», `[Text](app:#anker)` → Link in die App. Leerzeile = neuer Absatz, Zeilen mit `- ` = Liste.

### Fragen (`questions`)

```js
{
  id: 'q-architektur',
  prompt: 'Welche Netzwerkarchitektur …?',
  fields: [line('Layer sizes:')],            // line | area (text) | shot (Screenshots) | resultTable (Tabelle)
  check: { type: 'numbers', values: [1600, 11, 1], ordered: true, hint: '…' },   // optional, Prüfen-Knopf
  refs: [{ q: 'q-gen-shot-1', label: 'Erstes Training' }],                       // optional, zeigt frühere Screenshots
  solution: { text: '…', example: true, blocks: [...], criteria: ['…'] },        // optional
}
```

- **Prüfen** (`check`): `numbers` sucht die erwarteten Zahlen im Antworttext (tolerant bei «17 623», «17'623»). `table` prüft Tabellen: erwartete Werte (`expected`, `tol`) und `consistency: true` (error = output − target). Werte, die vom Projekt abhängen (z. B. `smileys.json`), nach Änderungen am Projekt neu kontrollieren.
- **Musterlösung** erscheint erst, wenn etwas eingegeben wurde. `example: true` markiert Lösungen, die vom Zufall abhängen («dein Ergebnis darf abweichen»). `criteria` werden als Checkliste zum Abhaken gezeigt. Danach schätzen sich die SuS selbst ein (ja / teilweise / noch nicht).
- **Screenshots**: Einfügen per Strg/Cmd+V (die App kopiert Ergebnisse mit «copy to clipboard»), Drag & Drop oder Dateiauswahl. Bilder werden auf max. 1600 px verkleinert und in IndexedDB gespeichert. Mit `refs` binden spätere Aufgaben frühere Screenshots als Vorschau ein.

## Speicherung und Sicherung

- Text, Status und Namen: `localStorage` unter `nnpws:<id>:v1`. Screenshots: IndexedDB `nnpws`.
- Daten gelten pro Gerät, Browser-Profil und Webadresse. «Meine Daten» (oben rechts) exportiert alles in eine JSON-Datei (Format `nnplayground-worksheet`, Version 1) und lädt sie wieder. Diese Datei ist auch die Grundlage für eine spätere Lehrer-Übersicht.
- Löschen: einzelne Felder und Bilder (mit «Rückgängig»), ganze Kapitel, alles.
- Hinweis: Safari löscht Webseiten-Daten nach 7 Tagen ohne Besuch. Deshalb regelmässig sichern lassen.

## Noch nicht umgesetzt

Lehrer-Seite zum Einlesen mehrerer Sicherungsdateien, Zeitmessung pro Kapitel, Annotationen auf Screenshots.
