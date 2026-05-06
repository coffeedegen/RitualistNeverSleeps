import "./style.css";
import { Game } from "./Game";
import { Debug } from "./utils/debug";
import { Homepage } from "./ui/Homepage";

const canvas = document.getElementById("game");

if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error('Expected a single <canvas id="game"> in index.html.');
}

const root: HTMLCanvasElement = canvas;

let homepage: Homepage | null = null;
let game: Game | null = null;

function mountHomepage(): void {
  game?.dispose();
  game = null;

  homepage?.dispose();
  homepage = new Homepage({
    onInitiateRitual: () => {
      mountGame();
    },
  });

  Debug.log("homepage mounted");
}

function mountGame(): void {
  homepage?.dispose();
  homepage = null;

  game?.dispose();
  game = new Game(root, {
    onStartNewGame: () => {
      mountGame();
    },
    onBackToMainMenu: () => {
      mountHomepage();
    },
    onQuitConfirmed: () => {
      requestQuit();
    },
  });
  game.start();
  Debug.log("game started");
}

function requestQuit(): void {
  homepage?.dispose();
  homepage = null;

  game?.dispose();
  game = null;

  window.close();
  setTimeout(() => {
    if (!window.closed) {
      document.body.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;height:100vh;
          background:#000;color:#00ff50;font-family:monospace;font-size:18px;text-align:center;padding:24px;">
          You may now close this tab.
        </div>`;
    }
  }, 0);
}

// Show homepage first. Game starts only after "Initiate Ritual" is clicked.
mountHomepage();

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    homepage?.dispose();
    game?.dispose();
  });
}
