// Source of the worksheet "Erkennt ein Netz ein Lächeln?" (smileys).
//
// Markup inside strings:  **fett**  *kursiv*  [[term]] (Glossar-Popover, siehe ../shared/glossary.json)
//   {{ref:task-id}} -> "Aufgabe n"   {{fig:figure-id}} -> "Abb. n"   [Text](app:#anchor) -> Link in die App
// Blank line = new paragraph, lines starting with "- " = list.
// Task and question numbers are generated automatically; ids are the stable keys for stored answers.

const P = (...paragraphs) => paragraphs.join('\n\n');

const text = (value) => ({ type: 'text', text: value });
const merke = (value) => ({ type: 'merke', text: value });
const figure = (id, file, alt, caption, width) => ({ type: 'figure', id, src: `img/${file}`, alt, caption, width });
const solutionFigure = (file, alt, caption, width = 70) => ({ type: 'figure', src: `img/${file}`, alt, caption, width });
const line = (label, extra = {}) => ({ kind: 'line', label, ...extra });
const area = (label, rows = 3, extra = {}) => ({ kind: 'text', label, rows, ...extra });
const shot = (label, max = 1) => ({ kind: 'shot', label, max });
const resultTable = () => ({
  kind: 'table',
  rowHeader: 'sample no',
  cols: [{ key: 'output', label: 'output' }, { key: 'target', label: 'target' }, { key: 'error', label: 'error' }],
  rows: [{ id: '1', label: '1' }, { id: '6', label: '6' }, { id: '11', label: '11' }],
});
const solutionTable = (rows, caption) => ({ type: 'table', caption, head: ['sample no', 'output', 'target', 'error'], rows });

export default {
  id: 'smileys',
  label: 'Arbeitsblatt 1',
  shortTitle: 'AB Smileys',
  brand: 'NN Playground',
  title: 'Erkennt ein Netz ein Lächeln?',
  subtitle: 'Erstkontakt mit NNPlayground und dem Projekt «smileys»',
  appRoot: '../../',
  facts: [
    { label: 'Zeit', value: 'ca. 90 min' },
    { label: 'Niveau', value: '11./12. Klasse' },
    { label: 'Fokus', value: 'beobachten · testen · trainieren' },
  ],
  leitfrage: 'Wie lernt ein neuronales Netz Smileys zu beurteilen – und wie setzt man ein solches Projekt in der NNPlayground-App um?',
  footer: 'nicolasruh.github.io/nnplayground · Stand: 20.10.2026',

  intro: [
    { type: 'heading', text: 'Das kannst du nach diesem Arbeitsblatt' },
    {
      type: 'goals',
      items: [
        '[[train-test|Training samples und test samples]] unterscheiden.',
        'Ein Bild als 40 × 40 [[input]]-Werte zwischen 0 und 1 beschreiben.',
        '[[input|Input]], [[hidden-layer|hidden layer]], [[output]], [[target]], [[error]] und [[weights]] in der network visualisation zuordnen.',
        'Zeigen, dass [[training]] die [[weights|Gewichte (weights)]] und damit die Vorhersagen (predictions) verändert.',
        'Erklären, wieso gute Performance mit den training samples noch nicht bedeutet, dass das Netz die eigentliche Aufgabe gelernt hat.',
      ],
    },
    { type: 'heading', text: 'Startklar' },
    text('Öffne die App: [https://nicolasruh.github.io/nnplayground/](app:)'),
    text('Arbeite ggf. zu zweit: Eine Person bedient, die andere protokolliert. Wechselt ab und zu die Rollen.'),
    { type: 'profile' },
    {
      type: 'info',
      title: 'So arbeitest du mit diesem Arbeitsblatt',
      text: P(
        '- Lass die App und dieses Blatt nebeneinander offen (zwei Fenster oder zwei Hälften des Bildschirms).',
        '- Alles, was du hier eingibst, wird automatisch in deinem Browser gespeichert. Mit «Meine Daten» oben rechts kannst du es als Datei sichern.',
        '- Screenshots: In der App gibt es bei den Ergebnissen den Knopf «copy to clipboard». Klicke danach hier ins Bild-Feld und drücke Strg/Cmd + V. Du kannst Bilder auch hineinziehen oder eine Datei wählen.',
        '- Die Musterlösung erscheint, sobald du eine eigene Antwort eingegeben hast. Vergleiche dann ehrlich und schätze dich selbst ein.',
        '- Unterstrichene Fachbegriffe kannst du anklicken: Du siehst eine kurze Erklärung und den passenden Abschnitt aus dem Infotext der App.',
      ),
    },
    { type: 'heading', text: 'Sechs Begriffe für heute' },
    {
      type: 'table',
      head: ['Begriff in der App', 'Arbeitsdefinition'],
      rows: [
        ['[[!sample]]', 'ein Beispiel aus input-Werten und einem target'],
        ['[[!input]]', 'Werte, die in das Netz hineingehen; hier 1600 Pixelwerte'],
        ['[[!target]]', 'gewünschter Sollwert (target) eines Beispiels'],
        ['[[!output]]', 'aktuelle Vorhersage (prediction) des Netzes zwischen 0 und 1'],
        ['[[!weights]]', 'Zahlen an den Verbindungen; sie bestimmen die Weitergabe von Aktivierungen (activations) im Netz'],
        ['[[!training]] / [[!testing]]', 'weights verändern / predictions nur auswerten'],
      ],
    },
  ],

  chapters: [
    // ------------------------------------------------------------------ 1
    {
      id: 'kap-projekt',
      title: 'Projekt laden und Oberfläche lesen',
      time: '10–15 min',
      blocks: [
        {
          type: 'task',
          id: 't-projekt-laden',
          text: 'Wähle unter **Projects** das Projekt «smileys». Die Auswahl lädt das Projekt direkt.',
        },
        {
          type: 'task',
          id: 't-warten',
          text: 'Warte, bis [[architecture|network architecture]], [[weights]] und data gefüllt sind. Das Laden des Projekts kann bei vielen data-Einträgen oder weights kurz dauern.',
        },
        {
          type: 'task',
          id: 't-bereiche',
          text: 'Orientiere dich in der Oberfläche der App und finde die sechs Bereiche: projects · network architecture · weights · data · training/testing · network visualisation',
          media: [figure('abb-bereiche', 'abb1-bereiche.png', 'Ausschnitt der App mit den Bereichen Projects, Network architecture, Weights und Data (Tabelle mit Smiley-Samples).', 'Bereiche für network architecture, weights und data nach dem Laden von «smileys».', 80)],
          questions: [
            {
              id: 'q-architektur',
              prompt: 'Welche Netzwerkarchitektur ([[architecture|network architecture]]) hat das geladene Netz?',
              fields: [line('Layer sizes; input / hidden / output:')],
              check: { type: 'numbers', values: [1600, 11, 1], ordered: true, hint: 'Schau im Bereich network architecture nach: Input size, Hidden layer size, Output size.' },
              solution: {
                text: 'Das Netz besitzt 1600 input-Neuronen, 11 Neuronen im hidden layer und 1 output-Neuron. Zusätzlich gibt es nach der input- und der hidden-Schicht je ein [[!bias]]-Neuron. In der Anzeige steht daher: 1600 + 1 / 11 + 1 / 1.',
              },
            },
            {
              id: 'q-anzahl-weights',
              prompt: 'Wie viele Gewichte ([[weights]]) hat dieses Netz?',
              fields: [area('Anzahl Gewichte (inkl. Rechnung):', 2)],
              check: { type: 'numbers', values: [17623], hint: 'Jedes Neuron hat ein weight zu jedem Neuron der vorigen Schicht, dazu eines vom bias-Neuron. Rechne beide Schichtübergänge und addiere.' },
              solution: {
                text: P(
                  'Zwischen input layer und hidden layer liegen (1600 + 1) × 11 = 17 611 weights.',
                  'Zwischen hidden layer und output liegen (11 + 1) × 1 = 12 weights.',
                  'Insgesamt sind es 17 623 weights.',
                ),
              },
            },
            {
              id: 'q-samples-zaehlen',
              prompt: 'Zähle in der data-Tabelle:',
              fields: [line('Samples total / training samples / test samples:')],
              check: { type: 'numbers', values: [11, 6, 5], ordered: true, hint: 'Training samples erkennst du am Häkchen in der Spalte «train?».' },
              solution: { text: 'Die data-Tabelle enthält 11 samples: 6 training samples und 5 test samples.' },
            },
            {
              id: 'q-happy',
              prompt: 'Die target-Spalte ist überschrieben mit «happy?»: Was könnten die Werte 1 und 0 bedeuten?',
              fields: [area('', 2)],
              solution: { text: 'Der target-Wert 1 steht für ein glückliches Gesicht, der target-Wert 0 für ein nicht glückliches beziehungsweise trauriges Gesicht.' },
            },
          ],
        },
        merke('Die Netzwerkarchitektur legt die Form des Netzes und damit die Anzahl der weights fest. Die konkreten Zahlen für die aktuellen Gewichtungen stehen im Textfeld unter weights.'),
      ],
    },

    // ------------------------------------------------------------------ 2
    {
      id: 'kap-pixel',
      title: 'Beispiele sind Pixelwerte',
      time: '10 min',
      blocks: [
        text('Ein Smiley wirkt wie ein Bild. Für das Netz ist er jedoch eine Matrix aus Zahlen: 40 × 40 = 1600 [[input]]-Werte. In dieser Darstellung gilt 0 = schwarz, 1 = weiss; Graustufen liegen dazwischen.'),
        text('Diese Zahlen bilden die inputs der verschiedenen Beispiele ([[sample|samples]]) und werden in der Tabelle unter data angezeigt. Du kannst sie hier sogar ändern (**edit in table**), das ist aber bei so vielen Zahlen sehr unübersichtlich. Daher gibt es noch einen weiteren Modus: Mit **edit visually** (oder einem Klick auf das Auge-Symbol oder ein kleines Smiley) kannst du die Zahlen als Pixel darstellen und auch verändern.'),
        figure('abb-editor', 'abb2-editor.png', 'Visueller Dateneditor mit Pixel-Zeichenfläche (input), Zielwert (target) und der Liste der samples samt Kennzeichnung «train sample?».', 'Visueller Dateneditor: input-Bild, target und Kennzeichnung als training sample.', 62),
        {
          type: 'task',
          id: 't-experimentieren',
          text: 'Experimentiere ein bisschen mit den Möglichkeiten zur Anpassung von Daten. Finde heraus:',
          questions: [
            {
              id: 'q-input20',
              prompt: 'Welchen Wert hat der 20. input im ersten sample?',
              fields: [line('')],
              check: { type: 'numbers', values: [0], hint: 'Öffne das erste sample in edit in table und suche die Spalte i20.' },
              solution: { text: 'Der 20. input-Wert des ersten samples ist 0.' },
            },
            {
              id: 'q-pixel-schwarz',
              prompt: 'Wie macht man das Pixel ganz oben links schwarz?',
              fields: [area('', 2)],
              solution: { text: 'Man setzt den input-Wert i1 auf 0. Dadurch wird das Pixel oben links schwarz.' },
            },
            {
              id: 'q-pixel-grau',
              prompt: 'Wie macht man im zweiten sample das letzte Pixel in der obersten Zeile grau?',
              fields: [area('', 2)],
              solution: { text: 'Man setzt i40 ungefähr auf 0.5. Dadurch erscheint das letzte Pixel der obersten Zeile grau.' },
            },
            {
              id: 'q-1600',
              prompt: 'Erkläre in einem Satz: Warum braucht das Netz für ein 40 × 40-Bild genau 1600 inputs?',
              fields: [area('', 2)],
              solution: {
                text: 'Das Bild besitzt 40 × 40 = 1600 Pixel. Jedes Pixel wird durch genau einen Zahlenwert beschrieben und liefert deshalb genau einen input-Wert.',
                criteria: ['Jedes Pixel entspricht genau einem Zahlenwert.', '40 × 40 = 1600 Pixel, also 1600 input-Werte.'],
              },
            },
          ],
        },
        {
          type: 'task',
          id: 't-neues-sample',
          text: 'Erstelle ein neues sample. Zeichne ein glückliches Gesicht und lege dementsprechend als target den Wert 1 fest (**train sample?** nicht anklicken). Speichere mit **set data**.',
          questions: [
            {
              id: 'q-neues-sample-output',
              prompt: 'Klicke in der Datentabelle auf das neue sample – wie beurteilt das Netz das neue Beispiel?',
              fields: [area('Interpretiere den output in der network visualisation:', 3)],
              solution: {
                example: true,
                text: 'Mögliche Beobachtung: Der output beträgt etwa 0.28. Das Netz beurteilt den selbst gezeichneten Smiley damit eher als nicht glücklich. Bei einer anderen Zeichnung kann der output deutlich abweichen.',
              },
            },
          ],
        },
        merke('**target** und **output** sind nicht dasselbe: target ist der vorgegebene Sollwert; output ist die aktuelle Antwort (= prediction) des Netzes. Mit **train sample?** bestimmt man, ob das entsprechende Beispiel für das training des Netzes benutzt wird oder nur für zusätzliche Tests.'),
      ],
    },

    // ------------------------------------------------------------------ 3
    {
      id: 'kap-forward',
      title: 'Samples durch das Netz schicken',
      time: '15 min',
      blocks: [
        text('Im Folgenden wollen wir wieder mit den unveränderten Daten arbeiten. Nimm also die Änderungen in data zurück oder lade das «smileys»-Projekt noch einmal neu.'),
        text('Also: inputs sind Zahlen, targets sind Zahlen, weights auch – wie passt das alles zusammen? Genau das zeigt der Bereich network visualisation:'),
        figure('abb-visualisierung', 'abb3-visualisierung.png', 'Netzwerkvisualisierung des 1600–11–1-Netzes: input-Neuronen links (nur die ersten fünf gezeigt), hidden layer, output-Neuron «happy?», dazu target und error.', 'Netzwerkvisualisierung (network visualisation) des 1600–11–1-Netzes für ein ausgewähltes sample.', 66),
        text(P(
          'Mit einem Klick in die Datentabelle legst du fest, welches sample gerade in der network visualisation dargestellt wird. Die input-Werte werden in die Eingangsschicht (input layer) kopiert, dann per Multiplikation mit den Gewichten ([[weights]]) an die Zwischenschicht ([[hidden-layer|hidden layer]]) weitergegeben und von dort über weitere weights in einen output umgewandelt. Blaue Linien sind positive, rote negative weights; dünnere Striche stehen für kleinere Werte. Bei grossen Netzen werden nicht alle Werte gezeigt. Einzelheiten siehst du per Tooltip.',
          'Ein solcher Vorwärtsdurchlauf heisst [[forward-propagation|forward propagation]]. Den resultierenden output (prediction) kann man mit dem Sollwert (target) vergleichen. Die Differenz **output − target = [[error]]** soll beim training möglichst nahe bei 0 liegen.',
        )),
        {
          type: 'table',
          caption: 'Begriffe bezogen auf die Visualisierung (network visualisation)',
          head: ['Element', 'So liest du es heute'],
          rows: [
            ['input', '1600 Pixelneuronen, nur die ersten 5 werden ganz gezeigt; Punkte stehen für ausgelassene inputs'],
            ['hidden1', '11 Neuronen der (einzigen) Zwischenschicht (hidden layer); stärkere blaue Füllung = höhere Aktivierung (activation), s. numerischer Wert (Tooltip)'],
            ['output happy?', 'Vorhersage (prediction) zwischen 0 und 1'],
            ['blaue / rote Linien', 'positive / negative weights; die Dicke zeigt grob die Stärke, s. numerischer Wert (Tooltip)'],
            ['target / error', 'Sollwert (target) / Abweichung zwischen output und target: output − target'],
          ],
        },
        {
          type: 'task',
          id: 't-forward',
          text: 'Klicke in data auf ein sample. Dadurch läuft die forward propagation: input-Werte werden Schicht für Schicht bis zum output weitergegeben.',
          questions: [
            {
              id: 'q-wechsel',
              prompt: 'Was ändert sich beim Wechsel des samples? Was bleibt unverändert?',
              fields: [area('', 3)],
              solution: {
                text: 'Beim Wechsel des samples ändern sich die input-Werte, die Aktivierungen im hidden layer, der output sowie target und error. Unverändert bleiben die Netzwerkarchitektur und die weights, weil beim testing keine Gewichte angepasst werden.',
                criteria: ['Verändert: input-Werte, activations, output, target, error.', 'Unverändert: Architektur und weights.', 'Begründung: Beim Durchschicken eines samples wird nichts gelernt.'],
              },
            },
          ],
        },
        {
          type: 'task',
          id: 't-tabelle-vortrainiert',
          text: 'Klicke nacheinander auf die Zeilen 1, 6 und 11 der data-Tabelle. Auf diese Weise kannst du überprüfen, wie gut das aktuell geladene Netz funktioniert (performance). Trage ein:',
          questions: [
            {
              id: 'q-tab-vortrainiert',
              fields: [resultTable()],
              check: {
                type: 'table',
                consistency: true,
                tol: 0.02,
                expected: { 1: { output: 0.99, target: 1, error: -0.01 }, 6: { output: 0.02, target: 0, error: 0.02 }, 11: { output: 0.14, target: 0.5, error: -0.36 } },
              },
              solution: {
                text: 'Für das geladene, vortrainierte Projekt ergeben sich die folgenden Werte (error = output − target):',
                blocks: [solutionTable([['1', '0.99', '1', '−0.01'], ['6', '0.02', '0', '0.02'], ['11', '0.14', '0.5', '−0.36']])],
              },
            },
          ],
        },
        {
          type: 'task',
          id: 't-live',
          text: 'Du kannst das aktuell verarbeitete sample auch live anpassen. Wähle ein glückliches Smiley in der Datentabelle, klicke dann auf das Auge in der linken Spalte der network visualisation.',
          media: [figure('abb-live', 'abb4-live-eingabe.png', 'Dialog «set input visually» mit einem gezeichneten glücklichen Smiley im 40×40-Pixelraster.', 'Live-Eingabe für einen eigenen 40 × 40-Smiley.', 36)],
          questions: [
            {
              id: 'q-live-output',
              prompt: 'Wie beurteilt das Netz dieses sample?',
              fields: [line('output:')],
              solution: {
                example: true,
                text: 'Beispiel mit sample 3: Der output liegt bei 0.99. Das Netz beurteilt diesen Smiley daher mit hoher Sicherheit als glücklich.',
              },
            },
            {
              id: 'q-live-aendern',
              prompt: 'Ändere die Pixel des glücklichen Smileys, bis das Netz es für unglücklich hält.',
              fields: [shot('Screenshot einfügen', 2), line('resultierender output:')],
              solution: {
                example: true,
                text: 'Eine mögliche Veränderung senkt den output auf 0.26. Andere Zeichnungen können zu anderen Werten führen; der Screenshot zeigt nur ein Beispiel.',
                blocks: [solutionFigure('l-live-ungluecklich.png', 'Live-Eingabe mit einem veränderten, traurigen Smiley.', null, 36)],
              },
            },
            {
              id: 'q-live-warum',
              prompt: 'Wieso führen diese neuen Pixel jetzt zu einem sehr kleinen output?',
              fields: [area('Ggf. vermuten, formuliere vorsichtig:', 3)],
              solution: {
                text: 'Durch die veränderten Pixel ändern sich mehrere input-Werte. Diese werden mit den gelernten weights gewichtet und erzeugen dadurch andere Aktivierungen im hidden layer. In diesem Beispiel fehlen Merkmale, die das Netz mit einem glücklichen Gesicht verbindet, oder es kommen Merkmale hinzu, die den output senken. Entscheidend ist also nicht nur die Anzahl schwarzer Pixel, sondern auch ihre Position und Gewichtung.',
                criteria: ['Andere Pixel bedeuten andere input-Werte.', 'Die input-Werte werden mit den (gleichen, gelernten) weights verrechnet, das ergibt andere activations.', 'Position und Gewichtung der Pixel zählen, nicht nur deren Anzahl.'],
              },
            },
          ],
        },
      ],
    },

    // ------------------------------------------------------------------ 4
    {
      id: 'kap-training',
      title: 'Training',
      time: '10 min',
      blocks: [
        text('Das zu Beginn geladene Smileys-Projekt war bereits trainiert, so erklärt sich seine oft korrekte Beurteilung der Pixelwerte (performance, s. {{ref:t-tabelle-vortrainiert}}). Jetzt wollen wir von vorn beginnen:'),
        {
          type: 'task',
          id: 't-random',
          text: 'Klicke im Bereich weights auf **random weights**. Du kannst stattdessen auch den roten Knopf **Reset** verwenden. Beides ersetzt den gesamten Satz von weights durch neue Zufallswerte.',
        },
        {
          type: 'task',
          id: 't-tabelle-random',
          text: 'Wähle wieder einzelne samples in der Tabelle und notiere die Ergebnisse:',
          questions: [
            {
              id: 'q-tab-random',
              fields: [resultTable()],
              check: { type: 'table', consistency: true, tol: 0.02, expected: { 1: { target: 1 }, 6: { target: 0 }, 11: { target: 0.5 } } },
              solution: {
                example: true,
                text: 'Ein möglicher Durchlauf nach random weights liefert die folgenden Werte. Wegen der Zufallsgewichte sind andere Resultate ebenso korrekt:',
                blocks: [solutionTable([['1', '0.30', '1', '−0.70'], ['6', '0.31', '0', '0.31'], ['11', '0.27', '0.5', '−0.23']])],
              },
            },
          ],
        },
        {
          type: 'task',
          id: 't-vergleich',
          text: 'Vergleiche output und error mit vorhin ({{ref:t-tabelle-vortrainiert}}).',
          questions: [
            {
              id: 'q-vergleich',
              prompt: 'Beschreibe die Unterschiede und versuche dich an einer Erklärung: Was hat sich (als einziges) geändert, und wie erklärt das die neue, deutlich schlechtere performance?',
              fields: [area('', 4)],
              solution: {
                text: 'Die inputs und targets sind gleich geblieben. Geändert wurden nur die zufälligen weights. Dadurch entstehen andere Aktivierungen, outputs und errors; die performance ist deutlich schlechter, weil die neuen weights noch nicht an den Beispielen trainiert wurden.',
                criteria: ['Beschreibt den Unterschied bei output und error mit Zahlen.', 'Nennt als einzige Änderung die weights (inputs und targets blieben gleich).', 'Begründet: Die neuen weights sind noch nicht auf die samples abgestimmt.'],
              },
            },
          ],
        },
        merke('Was du jetzt gerade siehst, ist die performance eines noch nicht trainierten Netzwerks (das zu Beginn geladene Projekt enthielt bereits trainierte weights).'),
        text('Jetzt wollen wir die performance wieder verbessern, dafür muss das Netz trainiert werden.'),
        text('[[training|Training]] bedeutet, dass ein sample durch das Netz geschickt wird (forward propagation) und dann rückwärts ([[backpropagation]]) berechnet wird, welche weights wie angepasst werden müssen, damit der error kleiner wird. Während des Trainings ändern sich also die weights, was den output beeinflusst.'),
        {
          type: 'task',
          id: 't-train-sample',
          text: 'Wähle sample 1 und klicke wiederholt auf **train current sample**. Beobachte den output.',
          questions: [
            {
              id: 'q-klicks',
              prompt: 'Wie oft musst du klicken, bis der output grösser wird als 0.85?',
              fields: [line('Anzahl Klicks:')],
              solution: { example: true, text: 'In diesem Beispiel waren 24 Klicks nötig, bis der output über 0.85 lag. Die genaue Anzahl hängt von den zufälligen Startgewichten ab.' },
            },
            {
              id: 'q-sample6',
              prompt: 'Wähle jetzt sample 6 (target = 0). Wie hat sich dessen output verändert (vergleiche {{ref:t-tabelle-random}})?',
              fields: [area('', 3)],
              solution: {
                example: true,
                text: 'Der output von sample 6 stieg in diesem Durchlauf von ungefähr 0.31 auf 0.85, obwohl sein target 0 ist. Das Training mit sample 1 hat gemeinsame weights in Richtung eines höheren outputs verändert und dadurch die Vorhersage für sample 6 verschlechtert.',
              },
            },
          ],
        },
        merke('Wie du siehst, kann training mit einem Beispiel die performance anderer Beispiele verschlechtern. Daher trainiert man neuronale Netze mit vielen samples in variierender Reihenfolge.'),
        text('Eine Epoche ([[epoch]]) ist die einmalige Präsentation aller training samples, in zufälliger Reihenfolge.'),
        {
          type: 'task',
          id: 't-epochen',
          text: 'Ausprobieren: Wie oft musst du auf **train 1 epoch** klicken, bis der error für sample 1 UND sample 6 kleiner ist als ±0.15? Wird der error in jeder Epoche, für jedes sample kleiner?',
          questions: [
            {
              id: 'q-epochen',
              fields: [area('', 3)],
              solution: {
                example: true,
                text: 'Mögliches Ergebnis: In der ersten epoch wurde der error von sample 1 zunächst sogar grösser. Nach 41 Epochen lagen die outputs bei ungefähr 0.86 für sample 1 und 0.15 für sample 6. Die Zahlen variieren. Der error eines einzelnen samples muss nicht in jeder epoch sinken, weil Gewichtsänderungen zugunsten anderer samples dieses Ergebnis vorübergehend verschlechtern können.',
              },
            },
          ],
        },
      ],
    },

    // ------------------------------------------------------------------ 5
    {
      id: 'kap-performance',
      title: 'Performance beurteilen: error (loss, cost)',
      time: '15 min',
      blocks: [
        text('Die (sich ändernde) performance des Netzes lässt sich auch systematischer evaluieren: Im Bereich testing kannst du alle training samples durch das Netz schicken und die Resultate anzeigen:'),
        figure('abb-testing', 'abb5-testing.png', 'Fenster «testing results» mit den sechs training samples: output als Balken, target und error je sample, oben die Performance (cost).', 'Die performance bezüglich mehrerer samples testen und beurteilen.', 62),
        text(P(
          'Dieser Test zeigt die performance des aktuellen Netzes für alle training samples. Die Spalte error zeigt den eigentlichen Fehler und, per Rahmenfarbe, eine simple Interpretation der prediction: korrekt/grün, wenn die Abweichung vom target kleiner ist als ±0.5, ansonsten falsch/rot.',
          'In Orange wird oben auch eine Einschätzung der gesamten Leistung ([[cost]]) mit diesen samples angezeigt.',
        )),
        {
          type: 'task',
          id: 't-test-train-1',
          text: 'Klicke unter testing auf **test with train data**. Füge einen Screenshot ein:',
          questions: [
            {
              id: 'q-shot-test-train-1',
              fields: [shot('Screenshot', 1)],
              solution: {
                example: true,
                text: 'Beispielergebnis vor dem längeren Training. Die dargestellten outputs und der cost-Wert gehören zu diesem konkreten Durchlauf und dürfen abweichen.',
                blocks: [solutionFigure('l-test-train-vorher.png', 'Testing results (train data) nach 41 Epochen: outputs nähern sich den targets, cost ca. 0.012.', null, 62)],
                criteria: ['Der Screenshot zeigt «testing results (train data, 6 samples)».', 'Du kannst an output, error und cost ablesen, wie gut das Netz die training samples aktuell beurteilt.'],
              },
            },
          ],
        },
        {
          type: 'task',
          id: 't-infotext',
          text: 'Informiere dich im Erklärtext unterhalb der App über die Unterschiede zwischen den Begriffen [[error]], [[loss]] und [[cost]]. Du kannst die Begriffe hier anklicken oder direkt im [Infotext der App](app:#error-function) nachlesen.',
          questions: [
            {
              id: 'q-error-loss-cost',
              prompt: 'Erkläre in je einem Satz, was error, loss und cost bedeuten.',
              fields: [area('', 4)],
              solution: {
                text: 'error bezeichnet hier die gerichtete Abweichung zwischen output und target bei einem Beispiel (output − target). loss ist ein nicht negativer Fehlerwert für ein einzelnes sample, beispielsweise der quadrierte error. cost fasst die losses mehrerer samples zusammen; in NNPlayground wird dafür der Durchschnitt verwendet.',
                criteria: ['error: Abweichung bei einem Output-Neuron (mit Vorzeichen).', 'loss: Fehler eines ganzen samples (nicht negativ).', 'cost: Durchschnitt der losses über mehrere samples.'],
              },
            },
          ],
        },
        text('Vermutlich werden in deinem Projekt nicht alle training samples korrekt erkannt. Also mehr trainieren:'),
        {
          type: 'task',
          id: 't-train-500',
          text: 'Lasse learning rate = 0.3, momentum = 0 und epochs = 500. Klicke einfach auf **train 500 epochs** und warte bis zum Ende. Beobachte, wie sich cost während des Trainings entwickelt.',
          questions: [
            {
              id: 'q-shot-graph',
              fields: [shot('Screenshot des Trainingsgraphen', 1)],
              solution: {
                example: true,
                text: 'Im gezeigten Beispiel sinkt cost während des Trainings stark und liegt am Ende ungefähr bei 0.0003. Das zeigt, dass das Netz seine outputs zunehmend an die targets der training samples angepasst hat. Der genaue Kurvenverlauf kann variieren.',
                blocks: [solutionFigure('l-trainingsgraph.png', 'Trainingsgraph: cost fällt in den ersten Epochen steil und nähert sich danach 0.', null, 66)],
              },
            },
          ],
        },
        text('Vermutlich ist cost während des Trainings deutlich gesunken, das Netz hat etwas gelernt. Genauer:'),
        {
          type: 'task',
          id: 't-test-train-2',
          text: 'Klicke unter testing auf **test with train data**. Füge einen Screenshot ein:',
          questions: [
            {
              id: 'q-shot-test-train-2',
              fields: [shot('Screenshot', 1)],
              solution: {
                example: true,
                text: 'Nach dem Training liegen die outputs der sechs training samples nahe bei ihren targets; alle werden nach der einfachen Farblogik der App korrekt beurteilt. Auch dieser Screenshot ist nur ein mögliches Resultat.',
                blocks: [solutionFigure('l-test-train-nachher.png', 'Testing results (train data) nach 541 Epochen: outputs nahe an den targets, alle Rahmen grün, cost ca. 0.0003.', null, 62)],
              },
            },
          ],
        },
        {
          type: 'task',
          id: 't-zusammenfassung',
          text: 'Fasse die Ergebnisse zusammen: a) wie funktioniert das training neuronaler Netze und b) was genau hat dein Netz gelernt?',
          questions: [
            {
              id: 'q-zusammenfassung-a',
              fields: [area('', 5)],
              solution: {
                text: 'Beim training wird für ein sample zunächst per forward propagation ein output berechnet. Der Vergleich mit dem target liefert error beziehungsweise loss. Anschliessend wird per backpropagation bestimmt, in welche Richtung die weights verändert werden müssen, damit der loss kleiner wird. Eine epoch verarbeitet alle training samples einmal. Über viele Epochen soll dadurch der gemeinsame cost sinken.',
                criteria: ['forward propagation liefert den output.', 'Vergleich mit dem target ergibt error / loss.', 'backpropagation bestimmt, wie die weights angepasst werden.', 'Viele epochs wiederholen das, bis die cost klein ist.'],
              },
            },
            {
              id: 'q-zusammenfassung-b',
              fields: [area('', 4)],
              solution: {
                text: 'Das Netz hat zunächst vor allem weights gelernt, mit denen es die sechs training samples passend beurteilt. Das beweist noch nicht, dass es die allgemeine Regel «glücklich oder nicht glücklich» gelernt hat. Dafür muss es auch bei unbekannten test samples gute predictions liefern.',
                criteria: ['Das Gelernte steckt in den weights.', 'Gelernt wurde zunächst nur für die training samples.', 'Ob die allgemeine Aufgabe gelernt wurde, zeigen erst die test samples.'],
              },
            },
          ],
        },
      ],
    },

    // ------------------------------------------------------------------ 6
    {
      id: 'kap-generalisierung',
      title: 'Generalisierung',
      time: '15 min',
      blocks: [
        text('Es ist zu erwarten, dass dieses Netz innerhalb von 500 Epochen training ein Set von weights gefunden hat, das mit den training samples nur minimale Abweichungen zwischen prediction und target zeigt. Aber darum geht es nur indirekt: Die training samples sind gedacht als (hier nur 6) Beispiele für eine allgemeinere Aufgabe (hier: glückliche Smileys von unglücklichen unterscheiden). Um zu beurteilen, inwiefern das Netz die allgemeine Aufgabe lösen kann ([[generalisation|Generalisierung]]), testen wir es mit weiteren Beispielen, die während des Trainings nicht verarbeitet wurden ([[train-test|test samples]]).'),
        {
          type: 'task',
          id: 't-test-test',
          text: 'Klicke unter testing auf **test with test data**.',
          questions: [
            {
              id: 'q-gen-shot-1',
              prompt: 'Füge einen Screenshot ein:',
              fields: [shot('Screenshot von test with test data', 1)],
              solution: {
                example: true,
                text: 'Beispiel für test with test data nach dem ersten selbst durchgeführten Training:',
                blocks: [solutionFigure('l-test-test-1.png', 'Testing results (test data, 5 samples) nach dem ersten Training: samples 4 und 5 werden falsch beurteilt.', null, 62)],
              },
            },
            {
              id: 'q-gen-urteil-1',
              prompt: 'Beurteile die Generalisierungsfähigkeit deines Netzes: Hat es die allgemeine Aufgabe gelernt? Mit welchen samples hat es Mühe?',
              refs: [{ q: 'q-gen-shot-1', label: 'Dein Test mit test data' }],
              fields: [area('Dein Urteil (mit Bezug auf einzelne samples):', 4)],
              solution: {
                example: true,
                text: 'In diesem Beispiel generalisiert das Netz nur teilweise. Die test samples 4 und 5 werden als nicht glücklich beurteilt, obwohl ihr target 1 ist. Die samples 9 und 10 werden korrekt als nicht glücklich erkannt. Bei sample 11 (target 0.5) liegt der output mit etwa 0.10 deutlich unter dem neutralen target. Andere Trainingsdurchläufe können ein anderes Muster zeigen.',
                criteria: ['Nennt konkrete test samples mit ihrer Nummer.', 'Vergleicht output und target mit Zahlen.', 'Zieht ein Fazit: Aufgabe gelernt, teilweise oder nicht.'],
              },
            },
          ],
        },
        {
          type: 'task',
          id: 't-neu-trainieren',
          text: 'Trainiere das Netz noch einmal neu und teste dann Trainingserfolg und Generalisierungsfähigkeit: **Reset** → **train 500 epochs** → **test with train data** und **test with test data**.',
          questions: [
            {
              id: 'q-gen-shot-2',
              prompt: 'Füge Screenshots beider Tests ein.',
              fields: [shot('Screenshots von beiden Tests', 2)],
              solution: {
                example: true,
                text: 'test with train data – mögliches Ergebnis:',
                blocks: [
                  solutionFigure('l-train-2.png', 'Testing results (train data) nach dem zweiten Training.', null, 62),
                  { type: 'text', text: 'test with test data – mögliches Ergebnis:' },
                  solutionFigure('l-test-2.png', 'Testing results (test data) nach dem zweiten Training.', null, 62),
                ],
              },
            },
            {
              id: 'q-urteil-training-2',
              prompt: 'Beurteile den Trainingserfolg dieser Version: Ist die prediction wieder nahe an den targets? Gilt das für alle training samples? Sind die Werte genau gleich wie letztes Mal? Warum (nicht)?',
              refs: [{ q: 'q-gen-shot-2', label: 'Zweites Training' }],
              fields: [area('Dein Urteil:', 4)],
              solution: {
                example: true,
                text: 'Der Trainingserfolg ist in diesem Durchlauf sehr gut: Die outputs aller training samples liegen nahe bei ihren targets, und cost ist mit ungefähr 0.00045 sehr klein. Die Werte sind nicht exakt gleich wie beim ersten Training, weil neue Zufallsgewichte verwendet wurden und die Reihenfolge der samples innerhalb der Epochen variiert.',
                criteria: ['Beurteilt alle training samples, nicht nur eines.', 'Erkennt, dass die Werte nicht identisch sind.', 'Begründet mit Zufallsgewichten und wechselnder Reihenfolge der samples.'],
              },
            },
            {
              id: 'q-urteil-gen-2',
              prompt: 'Beurteile die Generalisierungsfähigkeit dieser Version: Werden jetzt alle samples korrekt beurteilt? Gibt es mit denselben samples Probleme wie vorher? Warum (nicht)?',
              refs: [{ q: 'q-gen-shot-1', label: 'Erstes Training (test data)' }, { q: 'q-gen-shot-2', label: 'Zweites Training' }],
              fields: [area('Dein Urteil:', 4)],
              solution: {
                example: true,
                text: 'Auch die Generalisierung ist diesmal besser (cost bei den test samples etwa 0.065 statt 0.135), aber nicht perfekt. Sample 4 wird weiterhin falsch beurteilt; sample 5 wird nun korrekt erkannt. Die samples 9 und 10 werden richtig beurteilt, und sample 11 liegt mit etwa 0.21 näher an seinem target 0.5 als beim ersten Training. Dass sich gerade sample 5 verbessert, zeigt: Verschiedene Trainingsdurchläufe können trotz gleicher Daten unterschiedliche Generalisierungsleistungen ergeben.',
                criteria: ['Vergleicht die test samples mit dem ersten Durchlauf.', 'Nennt Samples, die weiterhin oder neu Probleme machen.', 'Erkennt, dass gleiche Daten unterschiedliche Ergebnisse liefern können.'],
              },
            },
          ],
        },
        {
          type: 'task',
          id: 't-vortrainiert-vergleich',
          text: 'Noch ein Vergleich: Lade das Smileys-Projekt neu – damit werden die weights wieder in den bereits vortrainierten Zustand versetzt. Führe wieder beide Tests durch.',
          questions: [
            {
              id: 'q-gen-shot-3',
              prompt: 'Füge Screenshots beider Tests ein.',
              fields: [shot('Screenshots von beiden Tests', 2)],
              solution: {
                example: true,
                text: 'Trainingserfolg (test with train data):',
                blocks: [
                  solutionFigure('l-train-vortrainiert.png', 'Testing results (train data) mit den vortrainierten weights.', null, 62),
                  { type: 'text', text: 'Generalisierung (test with test data):' },
                  solutionFigure('l-test-vortrainiert.png', 'Testing results (test data) mit den vortrainierten weights.', null, 62),
                ],
              },
            },
            {
              id: 'q-urteil-vortrainiert',
              prompt: 'Beurteile diesen Durchgang im Vergleich zu deinen selbst durchgeführten Trainings: Sind Trainingserfolg und Generalisierungsfähigkeit vergleichbar? Wo ergeben sich die grössten Unterschiede? Was könnte der Grund dafür sein?',
              refs: [{ q: 'q-gen-shot-1', label: 'Erstes Training' }, { q: 'q-gen-shot-2', label: 'Zweites Training' }, { q: 'q-gen-shot-3', label: 'Vortrainiert' }],
              fields: [area('Dein Urteil:', 4)],
              solution: {
                example: true,
                text: P(
                  'Im vorhandenen test-data-Screenshot erreicht das vortrainierte Netz mit cost ≈ 0.02842 die beste Generalisierungsleistung der drei gezeigten Hauptdurchläufe; die vier eindeutigen test samples liegen innerhalb der einfachen Fehlergrenze (output näher am target als am Gegenteil).',
                  'Die Unterschiede lassen sich sicher auf andere weights zurückführen; ohne Kenntnis des ursprünglichen Trainings sollte man aber nicht behaupten, welcher einzelne Trainingsfaktor dafür verantwortlich war.',
                ),
                criteria: ['Vergleicht alle drei Durchläufe.', 'Nennt die grössten Unterschiede bei konkreten samples.', 'Führt Unterschiede auf andere weights zurück und bleibt bei Vermutungen vorsichtig.'],
              },
            },
          ],
        },
        merke('Unterschiede zwischen den Screenshots der drei Durchläufe können sich nur daraus ergeben, dass jeweils ein anderes Set von weights verwendet wird: bei zweien davon hast du das training selbst durchgeführt.'),
        {
          type: 'task',
          id: 't-grosses-bild',
          text: 'Das grosse Bild: Vergleiche die resultierende Generalisierungsfähigkeit der verschiedenen Trainingsdurchläufe (siehe deine Screenshots).',
          questions: [
            {
              id: 'q-gb-immer-gleich',
              prompt: 'Klappt das Generalisieren immer gleich gut? Sind immer dieselben test samples problematisch?',
              refs: [{ q: 'q-gen-shot-1', label: 'Erstes Training' }, { q: 'q-gen-shot-2', label: 'Zweites Training' }, { q: 'q-gen-shot-3', label: 'Vortrainiert' }],
              fields: [area('', 3)],
              solution: {
                example: true,
                text: 'Nein. In den gezeigten Durchläufen bleibt sample 4 bei den beiden selbst trainierten Netzen problematisch, sample 5 wird dagegen einmal falsch und einmal korrekt beurteilt. Die samples 9 und 10 sind in allen gezeigten Tests vergleichsweise stabil. Diese Beobachtung gilt nur für die vorliegenden Durchläufe und ist kein allgemeines Gesetz.',
              },
            },
            {
              id: 'q-gb-unterschiede',
              prompt: 'Wieso ergeben sich überhaupt Unterschiede, wo doch der Prozess immer gleich war?',
              fields: [area('Hinweis: Gab es vielleicht doch minimale Unterschiede zwischen deinen beiden Durchläufen? Welche?', 4)],
              solution: {
                text: P(
                  'Die Startgewichte werden zufällig gewählt, und die Reihenfolge der training samples wird innerhalb der Epochen variiert. Ein nichtlineares Netz kann deshalb bei gleichen Einstellungen unterschiedliche Wege durch den Lernprozess nehmen und bei verschiedenen weight-Sätzen enden.',
                  'Dass auch die Reihenfolge einen Einfluss hat, zeigen beispielhaft die folgenden Ergebnisse, bei denen zwei Trainingsdurchläufe mit denselben Startgewichten gestartet wurden: Im ersten Durchlauf werden die samples 4 und 5 knapp richtig beurteilt (outputs ca. 0.57 und 0.56), im zweiten knapp falsch (ca. 0.45 und 0.49).',
                ),
                blocks: [
                  solutionFigure('l-reihenfolge-a.png', 'Testing results (test data) nach dem ersten Training mit bestimmten Startgewichten, cost ca. 0.063.', null, 62),
                  solutionFigure('l-reihenfolge-b.png', 'Testing results (test data) nach einem zweiten Training mit denselben Startgewichten, cost ca. 0.081.', null, 62),
                ],
                criteria: ['Nennt zufällige Startgewichte.', 'Nennt die wechselnde Reihenfolge der samples.'],
              },
            },
            {
              id: 'q-gb-aendern',
              prompt: 'Was könnte man (am training) ändern, damit die test samples zuverlässiger erkannt werden?',
              fields: [area('', 3)],
              solution: {
                text: 'Am wichtigsten wären mehr und vielfältigere training samples, besonders Beispiele, die den bisher problematischen test samples ähneln. Die Klassen sollten ausgewogen vertreten sein; für neutrale Smileys wären eigene Beispiele mit passendem target nötig. Zusätzlich könnte man learning rate, Zahl der Epochen oder Netzwerkgrösse systematisch untersuchen und mehrere Trainingsdurchläufe vergleichen, möglicherweise gibt es effizientere Settings.',
                criteria: ['Mehr und vielfältigere training samples.', 'Beispiele, die den problematischen test samples ähneln.', 'Eventuell Parameter (learning rate, epochs, Netzgrösse) untersuchen.'],
              },
            },
            {
              id: 'q-gb-warum-generalisieren',
              prompt: 'Wieso können neuronale Netze überhaupt (mehr oder weniger gut) generalisieren? Genauer: Wieso können Netze auch unbekannte Beispiele beurteilen, und weshalb ist dieses Urteil zumindest oft korrekt?',
              fields: [area('', 5)],
              solution: {
                text: 'Alle samples werden mit denselben weights verarbeitet. Während des Trainings bilden sich in diesen weights statistische Muster ab, die für mehrere Beispiele gemeinsam nützlich sind. Ein unbekanntes sample mit ähnlichen Merkmalen benutzt dieselben weights, erzeugt deshalb ähnliche Aktivierungen und oft einen passenden output. Generalisierung gelingt vor allem dann, wenn die training samples die späteren Fälle gut repräsentieren; bei stark abweichenden Beispielen kann sie scheitern.',
                criteria: ['Alle samples benutzen dieselben weights.', 'Ähnliche inputs führen zu ähnlichen activations und outputs.', 'Es klappt nur, wenn die training samples die neuen Fälle gut abdecken.'],
              },
            },
            {
              id: 'q-gb-sample11',
              star: true,
              prompt: 'Wieso ist sample 11 eigentlich kein fairer Test? Wie könnte man ihn fairer machen?',
              fields: [area('', 4)],
              solution: {
                text: 'Sample 11 hat target 0.5 und steht damit für einen neutralen oder unsicheren Fall. Unter den training samples gibt es jedoch nur targets 0 und 1; das Netz erhält also kein vergleichbares neutrales Beispiel. Fairer wäre der Test, wenn mehrere neutrale Smileys mit target 0.5 zu den training samples gehören würden. Alternativ müsste man die Aufgabe konsequent binär definieren und den neutralen Fall aus dem Test entfernen.',
              },
            },
          ],
        },
      ],
    },

    // ------------------------------------------------------------------ Exit ticket
    {
      id: 'kap-lernkontrolle',
      title: 'Lernkontrolle',
      numbered: false,
      kicker: 'Exit Ticket',
      blocks: [
        {
          type: 'task',
          id: 't-lernkontrolle',
          text: 'Formuliere dein gegenwärtiges Verständnis, indem du die angefangenen Sätze beendest – du darfst auch mehrere Sätze schreiben, gerne unter Bezug auf die anderen in diesem Arbeitsblatt (und in den Erklärtexten unterhalb der App) verwendeten Fachbegriffe.',
          questions: [
            {
              id: 'q-lk-sample',
              label: '1',
              prompt: 'Ein sample ist …',
              fields: [area('', 3)],
              solution: {
                text: 'Ein sample ist ein einzelnes Beispiel: Es besteht aus den input-Werten und dem zugehörigen target. In diesem Projekt bilden 1600 Pixelwerte die inputs, das target ist eine Zahl zwischen 1 (= glücklich) und 0 (= nicht glücklich).',
                criteria: ['input-Werte und target gehören zusammen.', 'Hier: 1600 Pixelwerte und ein target (1 oder 0).'],
              },
            },
            {
              id: 'q-lk-testing',
              label: '2',
              prompt: 'Beim Testen (testing) …',
              fields: [area('', 3)],
              solution: {
                text: 'Beim testing werden samples per forward propagation verarbeitet, ohne die weights zu verändern. Output beziehungsweise prediction werden mit dem target verglichen, um die performance zu beurteilen. Test samples wurden zuvor nicht zum Training verwendet.',
                criteria: ['Die weights ändern sich nicht.', 'output wird mit dem target verglichen.', 'Test samples sind nicht Teil des trainings.'],
              },
            },
            {
              id: 'q-lk-training',
              label: '3',
              prompt: 'Beim training …',
              fields: [area('', 3)],
              solution: {
                text: 'Beim training werden die training samples wiederholt verarbeitet. Aus der Abweichung zwischen output und target wird berechnet, wie die weights angepasst werden sollen. Dadurch sollen loss (Fehler pro sample) und cost (durchschnittlicher Fehler über mehrere samples, z. B. pro epoch) kleiner werden.',
                criteria: ['Samples werden wiederholt verarbeitet.', 'Aus dem error werden Anpassungen der weights berechnet.', 'Ziel: kleinere loss und cost.'],
              },
            },
            {
              id: 'q-lk-weights',
              label: '4',
              prompt: 'Unter weights versteht man …',
              fields: [area('', 3)],
              solution: {
                text: P(
                  'Unter weights versteht man die Zahlen an den Verbindungen zwischen Neuronen. Sie bestimmen, wie stark und mit welchem Vorzeichen die Aktivierung eines Neurons die Neuronen der nächsten Schicht beeinflusst.',
                  'Innerhalb einer gegebenen Architektur bestimmen ausschliesslich die weights, wie ein Netz die inputs verarbeitet und zu welchem «Urteil» es jeweils kommt. Der Lernprozess verändert ausschliesslich die weights. Somit steckt das Gelernte (das «Wissen» bzw. «Können» eines Netzwerks) in den weights.',
                ),
                criteria: ['Zahlen an den Verbindungen zwischen Neuronen.', 'Sie bestimmen, wie die inputs verarbeitet werden.', 'Training verändert nur die weights: Das Gelernte steckt in ihnen.'],
              },
            },
            {
              id: 'q-lk-generalisation',
              label: '5',
              prompt: 'Generalisation bedeutet …',
              fields: [area('', 3)],
              solution: {
                text: 'Generalisation bedeutet, dass ein Netz nicht nur bei den training samples kleine Fehler erreicht, sondern auch unbekannte test samples zuverlässig beurteilt. Im besten Fall hat es also die eigentliche Aufgabe (hier: glückliche Smileys von unglücklichen zu unterscheiden) gelernt. Wirklich sicher sein kann man aber nie, denn dafür müsste man das Netz mit allen (theoretisch) möglichen Beispielen testen. Schon am Beispiel der Smileys zeigt sich: Das sind mindestens SEHR viele (wenn man Grauwerte zulässt, gibt es sogar unendlich viele potenzielle Smileys, d. h. Verteilungen von 1600 Zahlenwerten zwischen 0 und 1).',
                criteria: ['Gute Ergebnisse auch bei unbekannten (test) samples.', 'Die allgemeine Aufgabe wurde gelernt, nicht nur die training samples.', 'Vollständig sicher kann man nie sein.'],
              },
            },
          ],
        },
      ],
    },

    // ------------------------------------------------------------------ Vertiefung
    {
      id: 'kap-vertiefung',
      title: 'Optionale Vertiefung mit Kurzexperiment',
      numbered: false,
      optional: true,
      kicker: 'Für Schnelle oder eine zweite Lektion',
      blocks: [
        text('Wenn ein neuronales Netz eine allgemeine Aufgabe lernen soll, dann braucht es dafür genügend (bezüglich Umfang und Qualität) Trainingsbeispiele. Versuche dir vorzustellen, wie viele verschiedene Verteilungen von 1600 Zahlen es gibt, die grob ein Smiley darstellen. Die allgemeine Aufgabe wäre erst dann vollkommen gelöst (= perfekte Generalisierung), wenn das Netz (oder dein Gehirn) all diese potenziellen Beispiele korrekt als entweder glücklich oder eben nicht beurteilen könnte. Es scheint offensichtlich viel verlangt, diese allgemeine Aufgabe auf der Basis von lediglich je 3 Beispielen für glückliche bzw. unglückliche Zahlenverteilungen zu erlernen. Eigentlich ist eher erstaunlich, dass es – zumindest im Ansatz – überhaupt funktioniert (siehe vorheriges Kapitel):'),
        merke('Ähnliche inputs werden durch die (für alle samples gleichen) weights ähnlich gewichtet und produzieren daher ähnliche outputs. Wenn sich das Netz also während des Trainings an die Verarbeitung eines bestimmten samples anpasst, lernt es dabei immer auch gleich etwas über weitere, «ähnliche» Beispiele. Aber waren die training samples einem neuen test sample ähnlich genug?'),
        text('Wenn ein Netz mit den Trainingsdaten eine gute Leistung zeigt, aber ungenügend generalisiert, dann liegt das meist daran, dass die Trainingsbeispiele den ungleich grösseren Bereich aller möglichen Beispiele nur ungenügend abdecken. Wenn wir die Generalisierungsleistung des Netzes verbessern wollen, brauchen wir also mehr und/oder bessere training samples. Ausprobieren:'),
        {
          type: 'task',
          id: 't-v-daten',
          text: 'Füge im bisherigen Projekt weitere Trainingsdaten hinzu, also mehrere Beispiele für glückliche und nicht glückliche (ggf. auch neutrale) Smileys. Setze auch die target-Werte entsprechend und markiere die neuen Beispiele als training samples. Behalte die test samples bei.',
        },
        {
          type: 'task',
          id: 't-v-reset',
          text: 'Setze die weights zurück und trainiere dann das Netz neu (500 epochs).',
        },
        {
          type: 'task',
          id: 't-v-beurteilen',
          text: 'Beurteile die performance nach dem training: Hat das Netz gelernt, auch die zusätzlichen samples korrekt zu beurteilen?',
        },
        {
          type: 'task',
          id: 't-v-test',
          text: P(
            'Teste dann, ob sich die Leistung mit den test samples verbessert hat:',
            '- Falls nein: mehr Trainingsdaten einfügen, Beispiele wählen, die den test samples ähneln.\n- Falls ja: Stabilität testen mit weiteren Trainingsdurchläufen, dazwischen weights zurücksetzen.',
          ),
        },
        {
          type: 'hinweis',
          text: 'Noch ein praktischer Hinweis: Den aktuellen Zustand eines Projekts kannst du (ganz oben) speichern. Klicke dafür auf **save project via JSON** und kopiere alles in eine Textdatei. Später kannst du diesen Zustand wiederherstellen, indem du **load or edit project via JSON** wählst und die gespeicherten Daten in das Textfenster kopierst.',
        },
        {
          type: 'task',
          id: 't-v-belege',
          text: 'Belege dein bestes Generalisierungsergebnis mit entsprechenden Screenshots:',
          questions: [
            {
              id: 'q-v-belege',
              fields: [shot('z. B. von data, Trainingsgraph, training-samples-Test, test-samples-Test, ggf. zusätzliche Live-Tests', 8)],
            },
          ],
        },
      ],
    },
  ],
};
