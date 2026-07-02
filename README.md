[https://nnplayground.com](https://nnplayground.com)


### How to run

After cloning the repository, run:
- ``npm install``
- ``npm start``
- Then open ``http://localhost:8080`` in your browser

For active development with automatic rebuilds when files change, use:
- ``npm run dev``
- Then open ``http://localhost:8080``

If you only want to rebuild without a server, use ``npm run build``.

For cleanup checks (unused locals/parameters), use:
- ``npm run check:unused``

### Share a Prototype Online (GitHub Pages)

This repository includes a workflow at ``.github/workflows/deploy-gh-pages.yml`` that deploys the app to GitHub Pages on every push to ``main``.

Setup once:
- Push this repository to GitHub.
- In GitHub: ``Settings -> Pages``.
- Under ``Build and deployment``, set ``Source`` to ``GitHub Actions``.
- Push to ``main`` (or run the workflow manually under ``Actions``).

Your prototype will then be available at:
- ``https://<your-user>.github.io/<your-repo>/``

Notes:
- For private repositories, GitHub Pages availability depends on your GitHub plan.
- The deployment artifact includes ``index.html``, ``main.css``, ``favicon.ico``, ``dist/``, and ``Projekts/``.
- ``data_resources/`` remains in the repository for future project generation but is intentionally not included in the prototype deployment.

### How to contribute
No rules, I'll accept any improvements. 

A few things that would be nice but I'm too lazy to implement:
- Ability to edit weights --> maybe hover over weight could show slider just like with inputs
- Graph of cost over iterations
