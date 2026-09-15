import { readFile, writeFile } from 'node:fs/promises';

const indexPath = new URL('../index.html', import.meta.url);
const sources = [
  { language: 'en', label: 'English', path: new URL('../infotext_en.html', import.meta.url) },
  { language: 'de', label: 'Deutsch', path: new URL('../infotext_de.html', import.meta.url) },
];
const startMarker = '<!-- INFO CONTENT START -->';
const endMarker = '<!-- INFO CONTENT END -->';

const escapeAttribute = (value) => value
  .replace(/&/g, '&amp;')
  .replace(/"/g, '&quot;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

const parseSections = (source) => {
  const tokens = [...source.matchAll(/<h([23])\s+id="([^"]+)">([\s\S]*?)<\/h\1>/g)];
  if (tokens.length === 0 || tokens[0][1] !== '2') {
    throw new Error('Infotext must begin with an h2 element that has an id.');
  }

  const sections = [];
  let currentSection;
  let currentSubsection;

  for (let index = 0; index < tokens.length; index++) {
    const match = tokens[index];
    const contentStart = match.index + match[0].length;
    const nextMatch = tokens[index + 1];
    const nextHeadingIndex = nextMatch ? nextMatch.index : source.lastIndexOf('</section>');
    const contentEnd = match[1] === '2' && nextMatch?.[1] === '3'
      ? nextMatch.index
      : nextHeadingIndex;
    const content = source.slice(contentStart, contentEnd).trim();
    const [, level, id, title] = match;

    if (level === '2') {
      currentSection = { id, title, content, subsections: [] };
      sections.push(currentSection);
      currentSubsection = null;
    } else {
      if (!currentSection) {
        throw new Error(`Subsection "${id}" has no parent section.`);
      }
      currentSubsection = { id, title, content };
      currentSection.subsections.push(currentSubsection);
    }
  }

  return sections;
};

const sourceIdToDomId = (language, sourceId) => `info-${language}-${sourceId}`;

const renderAccordion = (sections, language) => sections.map((section, sectionIndex) => {
  const expanded = sectionIndex === 0;
  const subsectionMarkup = section.subsections.map((subsection) => `
        <section class="info-subsection" id="${sourceIdToDomId(language, subsection.id)}" data-info-source-id="${escapeAttribute(subsection.id)}">
          <h3 class="info-subsection-heading">
            <button type="button" class="info-subsection-toggle" aria-expanded="false" aria-controls="${sourceIdToDomId(language, `${subsection.id}-content`)}">
              <span>${subsection.title}</span><span class="info-toggle-indicator" aria-hidden="true"></span>
            </button>
          </h3>
          <div class="info-subsection-content" id="${sourceIdToDomId(language, `${subsection.id}-content`)}" hidden>
${subsection.content}
          </div>
        </section>`).join('');

  return `
      <section class="info-section" id="${sourceIdToDomId(language, section.id)}" data-info-source-id="${escapeAttribute(section.id)}" data-language="${language}">
        <h2 class="info-section-heading">
          <button type="button" class="info-section-toggle" aria-expanded="${expanded}" aria-controls="${sourceIdToDomId(language, `${section.id}-content`)}">
            <span>${section.title}</span><span class="info-toggle-indicator" aria-hidden="true"></span>
          </button>
        </h2>
        <div class="info-section-content" id="${sourceIdToDomId(language, `${section.id}-content`)}"${expanded ? '' : ' hidden'}>
${section.content}${subsectionMarkup}
        </div>
      </section>`;
}).join('');

const fragments = await Promise.all(sources.map(async (source) => ({
  ...source,
  sections: parseSections(await readFile(source.path, 'utf8')),
})));

const expectedIds = fragments[0].sections.flatMap((section) => [section.id, ...section.subsections.map((subsection) => subsection.id)]);
for (const fragment of fragments.slice(1)) {
  const ids = fragment.sections.flatMap((section) => [section.id, ...section.subsections.map((subsection) => subsection.id)]);
  if (ids.join('|') !== expectedIds.join('|')) {
    throw new Error(`${fragment.path.pathname} does not match the English heading structure.`);
  }
}

const languageButtons = fragments.map((fragment, index) => `
      <button type="button" class="info-language-button${index === 0 ? ' is-active' : ''}" data-info-language="${fragment.language}" aria-pressed="${index === 0}">${fragment.label}</button>`).join('');
const languageContent = fragments.map((fragment, index) => `
    <div class="info-language-content" data-info-language-content="${fragment.language}"${index === 0 ? '' : ' hidden'}>
${renderAccordion(fragment.sections, fragment.language)}
    </div>`).join('');

const generatedMarkup = `${startMarker}
  <section class="info-accordion" aria-label="About neural networks">
    <div class="info-accordion-header">
      <h2 class="info-accordion-title">Understanding Neural Networks</h2>
      <div class="info-accordion-controls">
        <div class="info-language-selector" aria-label="Language">${languageButtons}
        </div>
      </div>
    </div>
    <div class="info-floating-controls" aria-label="Accordion controls">
      <button type="button" class="info-floating-button" data-info-expand="all" title="Open all sections" aria-label="Open all sections">open<br>all</button>
      <button type="button" class="info-floating-button" data-info-expand="none" title="Close all sections" aria-label="Close all sections">close<br>all</button>
      <span class="info-floating-separator" aria-hidden="true"></span>
      <button type="button" class="info-floating-button info-to-app-button" data-info-to-app title="Back to the app" aria-label="Back to the app">&uarr;</button>
    </div>
${languageContent}
  </section>
  <script>
    (() => {
      const accordion = document.querySelector('.info-accordion');
      if (!accordion) return;

      const setExpanded = (button, expanded) => {
        const contentId = button.getAttribute('aria-controls');
        if (!contentId) return;
        const content = document.getElementById(contentId);

        button.setAttribute('aria-expanded', String(expanded));

        if (content) content.hidden = !expanded;

        if (!expanded && button.classList.contains('info-section-toggle')) {
          content?.querySelectorAll('.info-subsection-toggle').forEach((subsectionButton) => {
            setExpanded(subsectionButton, false);
          });
        }
      };

      const setAllExpanded = (expanded) => {
        const activeContent = accordion.querySelector('[data-info-language-content]:not([hidden])');
        if (!activeContent) return;
        activeContent.querySelectorAll('.info-section-toggle, .info-subsection-toggle').forEach((button) => {
          setExpanded(button, expanded);
        });

        if (!expanded) {
          window.requestAnimationFrame(() => {
            accordion.scrollIntoView({ behavior: 'smooth', block: 'start' });
          });
        }
      };

      const openAnchor = () => {
        const sourceId = decodeURIComponent(window.location.hash.slice(1));
        if (!sourceId) return;
        const activeContent = accordion.querySelector('[data-info-language-content]:not([hidden])');
        const target = Array.from(activeContent?.querySelectorAll('[data-info-source-id]') || [])
          .find((element) => element.dataset.infoSourceId === sourceId)
          || Array.from(accordion.querySelectorAll('[data-info-source-id]'))
            .find((element) => element.dataset.infoSourceId === sourceId);
        if (!target) return;
        const languageContent = target.closest('[data-info-language-content]');
        if (languageContent) setLanguage(languageContent.dataset.infoLanguageContent);
        target.closest('.info-section')?.querySelector('.info-section-toggle') && setExpanded(target.closest('.info-section').querySelector('.info-section-toggle'), true);
        target.closest('.info-subsection')?.querySelector('.info-subsection-toggle') && setExpanded(target.closest('.info-subsection').querySelector('.info-subsection-toggle'), true);
        window.requestAnimationFrame(() => target.scrollIntoView({ behavior: 'smooth', block: 'start' }));
      };

      const setLanguage = (language) => {
        accordion.querySelectorAll('[data-info-language-content]').forEach((content) => {
          content.hidden = content.dataset.infoLanguageContent !== language;
        });
        accordion.querySelectorAll('[data-info-language]').forEach((button) => {
          const active = button.dataset.infoLanguage === language;
          button.classList.toggle('is-active', active);
          button.setAttribute('aria-pressed', String(active));
        });
      };

      accordion.querySelectorAll('.info-section-toggle, .info-subsection-toggle').forEach((button) => {
        button.addEventListener('click', (e) => {
          e.stopPropagation();
          const isExpanded = button.getAttribute('aria-expanded') === 'true';
          setExpanded(button, !isExpanded);

          if (isExpanded) {
            const section = button.closest('.info-section');
            if (section && section.getBoundingClientRect().top < 0) {
              section.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }
        });
      });

      accordion.querySelectorAll('[data-info-language]').forEach((button) => {
        button.addEventListener('click', () => setLanguage(button.dataset.infoLanguage));
      });

      accordion.querySelectorAll('[data-info-expand]').forEach((button) => {
        button.addEventListener('click', () => setAllExpanded(button.dataset.infoExpand === 'all'));
      });

      accordion.querySelector('[data-info-to-app]')?.addEventListener('click', () => {
        document.getElementById('id_header')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });

      window.addEventListener('hashchange', openAnchor);
      openAnchor();
    })();
  </script>
${endMarker}`;

const indexHtml = await readFile(indexPath, 'utf8');
const startIndex = indexHtml.indexOf(startMarker);
const endIndex = indexHtml.indexOf(endMarker);
if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
  throw new Error('Could not find infotext markers in index.html.');
}

await writeFile(indexPath, `${indexHtml.slice(0, startIndex)}${generatedMarkup}${indexHtml.slice(endIndex + endMarker.length)}`);