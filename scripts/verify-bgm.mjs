import { chromium } from "playwright";

function installAudioSpyScript() {
  return `
    (() => {
      const NativeAudio = window.Audio;
      const events = [];
      const pushEvent = (event) => events.push({ time: Date.now(), ...event });
      Object.defineProperty(window, "__audioEvents", {
        value: events,
        configurable: false,
        writable: false,
      });

      window.Audio = new Proxy(NativeAudio, {
        construct(target, args) {
          const audio = new target(...args);
          const describe = () => ({
            src: audio.currentSrc || audio.src || "",
            loop: audio.loop,
            volume: audio.volume,
            paused: audio.paused,
          });
          pushEvent({ type: "create", ...describe() });
          const origPlay = audio.play.bind(audio);
          const origPause = audio.pause.bind(audio);
          audio.play = (...playArgs) => {
            pushEvent({ type: "play-call", ...describe() });
            return origPlay(...playArgs)
              .then((value) => {
                pushEvent({ type: "play-resolved", ...describe() });
                return value;
              })
              .catch((error) => {
                pushEvent({ type: "play-rejected", message: String(error), ...describe() });
                throw error;
              });
          };
          audio.pause = (...pauseArgs) => {
            pushEvent({ type: "pause-call", ...describe() });
            return origPause(...pauseArgs);
          };
          audio.addEventListener("play", () => pushEvent({ type: "play-event", ...describe() }));
          audio.addEventListener("pause", () => pushEvent({ type: "pause-event", ...describe() }));
          audio.addEventListener("volumechange", () => pushEvent({ type: "volumechange", ...describe() }));
          return audio;
        },
      });
    })();
  `;
}

function summarize(events) {
  return events
    .filter((event) => ["create", "play-call", "play-resolved", "pause-call"].includes(event.type))
    .map((event) => ({
      type: event.type,
      src: String(event.src || "").split("/").slice(-1)[0],
      loop: event.loop,
      volume: typeof event.volume === "number" ? Number(event.volume.toFixed(2)) : event.volume,
    }));
}

async function installAudioSpy(page) {
  await page.addInitScript(installAudioSpyScript());
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();

  const walletData = JSON.stringify({
    address: "0x8bd8aaaaaaaaaaaaaaaaaaaaaaaaaaaaaae434",
    chainId: 1979,
    balance: "0",
    mode: "metamask",
    xHandle: "coffeedegen",
  });

  const pageTitle = await context.newPage();
  await installAudioSpy(pageTitle);
  await pageTitle.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle" });
  await pageTitle.evaluate((value) => localStorage.setItem("ritual_wallet_data", value), walletData);
  await pageTitle.reload({ waitUntil: "networkidle" });
  await pageTitle.waitForTimeout(500);
  const titleBeforeInteraction = await pageTitle.evaluate(() => window.__audioEvents.slice());
  await pageTitle.mouse.click(220, 220);
  await pageTitle.waitForTimeout(1000);
  const titleAfterInteraction = await pageTitle.evaluate(() => window.__audioEvents.slice());
  await pageTitle.getByRole("button", { name: /Initiate Ritual/i }).click();
  await pageTitle.waitForTimeout(1500);
  const gameplayAfterInitiate = await pageTitle.evaluate(() => window.__audioEvents.slice());

  const pageGameOver = await context.newPage();
  await installAudioSpy(pageGameOver);
  await pageGameOver.goto("http://127.0.0.1:5173/?debug=gameover", { waitUntil: "networkidle" });
  await pageGameOver.mouse.click(180, 180);
  await pageGameOver.waitForTimeout(1500);
  const gameOverDebug = await pageGameOver.evaluate(() => window.__audioEvents.slice());

  console.log(JSON.stringify({
    titleBeforeInteraction: summarize(titleBeforeInteraction),
    titleAfterInteraction: summarize(titleAfterInteraction),
    gameplayAfterInitiate: summarize(gameplayAfterInitiate),
    gameOverDebug: summarize(gameOverDebug),
  }, null, 2));

  await browser.close();
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
