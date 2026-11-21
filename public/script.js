(() => {
  "use strict";

  const allowedDates = ["2026-12-24", "2026-12-26", "2026-12-31", "2027-01-08"];
  const shortDate = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  const fullDate = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const year = (date) => date.slice(0, 4);
  const formatDate = (date, formatter = shortDate) =>
    formatter.format(new Date(`${date}T12:00:00Z`));
  const $ = (id) => document.getElementById(id);
  const form = $("vote-form");
  const fieldset = $("date-options");
  const button = $("submit-vote");
  const status = $("form-status");
  const results = $("results");
  const rows = $("result-rows");
  const retry = $("retry-results");
  const radios = [...form.querySelectorAll('input[name="date"]')];
  let poll = null;
  let draft = null;
  let saving = false;
  let loading = false;
  let requestVersion = 0;
  let pollTimer;
  let toastTimer;

  function showToast(message) {
    clearTimeout(toastTimer);
    $("toast").textContent = message;
    $("toast").hidden = false;
    toastTimer = setTimeout(() => {
      $("toast").hidden = true;
    }, 4500);
  }

  function setStatus(message, type = "") {
    if (status.textContent !== message) status.textContent = message;
    status.className = `form-status${type ? ` is-${type}` : ""}`;
  }

  function updateControls() {
    const saved = poll?.selectedDate ?? null;
    fieldset.disabled = !poll || saving;
    radios.forEach((radio) => {
      radio.checked = radio.value === draft;
      radio
        .closest(".date-option")
        .classList.toggle("is-saved", radio.value === saved);
    });
    button.disabled = !poll || !draft || saving || draft === saved;
    button.classList.toggle("is-saved", Boolean(saved && saved === draft));
    $("vote-button-text").textContent = saving
      ? "Saving your vote…"
      : saved === draft && saved
        ? "Your vote is counted"
        : !draft
          ? "Choose a date to vote"
          : saved
            ? "Update my vote"
            : "Cast my vote";
    $("vote-button-icon")
      .querySelector("use")
      .setAttribute("href", saved === draft && saved ? "#i-check" : "#i-arrow");
    form.setAttribute("aria-busy", String(saving));
  }

  function defaultStatus() {
    if (poll?.selectedDate && draft === poll.selectedDate) {
      setStatus(
        `You’re counted for ${formatDate(poll.selectedDate, fullDate)}.`,
        "success",
      );
    } else if (draft) {
      setStatus(
        poll?.selectedDate
          ? "Your previous vote counts until you save this change."
          : "Ready when you are. Make your choice count.",
      );
    } else {
      setStatus("Your vote stays anonymous. Just family, making plans.");
    }
  }

  function setLive(online) {
    $("live-status").classList.toggle("is-offline", !online);
    $("live-status").replaceChildren(
      document.createElement("span"),
      document.createTextNode(online ? "LIVE VOTE" : "OFFLINE"),
    );
    retry.hidden = online;
    $("update-caption").textContent = online
      ? "Live results · refreshes every 15 seconds"
      : poll
        ? "Showing the last available results"
        : "Waiting for a connection";
  }

  function makeRows() {
    rows.innerHTML = allowedDates
      .map(
        (date) => `
      <div class="result-row" data-result-date="${date}">
        <div class="result-heading"><span class="result-date">${formatDate(date)} <small>${year(date)}</small><span class="leader-mini" hidden>LEADING</span></span><span class="result-percentage">0%</span></div>
        <div class="result-track" role="progressbar" aria-label="Vote share for ${formatDate(date, fullDate)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div class="result-fill"></div></div>
        <p class="result-vote-count">0 votes</p>
      </div>`,
      )
      .join("");
  }

  function renderResults() {
    if (!rows.querySelector("[data-result-date]")) makeRows();
    $("total-votes").textContent = poll.total.toLocaleString("en-GB");
    $("total-label").textContent =
      poll.total === 1 ? "vote cast" : "votes cast";
    poll.options.forEach((option) => {
      const row = rows.querySelector(`[data-result-date="${option.date}"]`);
      if (!row) return;
      const isLeading = poll.leaders.includes(option.date);
      row.classList.toggle("is-leading", isLeading);
      row.querySelector(".leader-mini").hidden = !isLeading;
      row.querySelector(".leader-mini").textContent =
        poll.leaders.length > 1 ? "TIED" : "LEADING";
      row.querySelector(".result-percentage").textContent =
        `${option.percentage}%`;
      row
        .querySelector(".result-track")
        .setAttribute("aria-valuenow", String(option.percentage));
      row.querySelector(".result-fill").style.transform =
        `scaleX(${option.percentage / 100})`;
      row.querySelector(".result-vote-count").textContent =
        `${option.votes.toLocaleString("en-GB")} ${option.votes === 1 ? "vote" : "votes"}`;
    });
    if (!poll.total) {
      $("leader-title").textContent = "The first move is yours";
      $("leader-description").textContent =
        "No votes yet. Pick your date and get the family started.";
    } else if (poll.leaders.length > 1) {
      $("leader-title").textContent =
        `${poll.leaders.length} dates are tied for the lead`;
      $("leader-description").textContent =
        `${poll.leaders.map((date) => `${formatDate(date)} ${year(date)}`).join(" · ")}. Every new vote can make a difference.`;
    } else {
      const leader = poll.options.find(
        (option) => option.date === poll.leaders[0],
      );
      $("leader-title").textContent =
        `${formatDate(leader.date)} ${year(leader.date)} is in the lead`;
      $("leader-description").textContent =
        `${leader.percentage}% of the family’s votes. The most popular date is considered for our gathering.`;
    }
  }

  function applySnapshot(data, submitted = false) {
    // Only accept the known options; no remote strings are inserted into HTML.
    if (
      !data ||
      !Array.isArray(data.options) ||
      !Array.isArray(data.leaders) ||
      !Number.isInteger(data.total) ||
      data.total < 0 ||
      data.options.length !== allowedDates.length ||
      !allowedDates.every((date) =>
        data.options.some((option) => option?.date === date),
      ) ||
      data.options.some(
        (option) =>
          !option ||
          !allowedDates.includes(option.date) ||
          !Number.isInteger(option.votes) ||
          option.votes < 0 ||
          !Number.isFinite(option.percentage) ||
          option.percentage < 0 ||
          option.percentage > 100,
      ) ||
      data.leaders.some((date) => !allowedDates.includes(date)) ||
      (data.selectedDate !== null && !allowedDates.includes(data.selectedDate))
    ) {
      throw new Error("The results couldn’t be read. Please try again.");
    }
    if (submitted || draft === null || draft === poll?.selectedDate)
      draft = data.selectedDate;
    poll = data;
    renderResults();
    updateControls();
    defaultStatus();
    setLive(true);
    results.setAttribute("aria-busy", "false");
  }

  async function api(path, options = {}) {
    const response = await fetch(path, {
      credentials: "same-origin",
      cache: "no-store",
      signal: AbortSignal.timeout(18000),
      ...options,
    });
    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error("We couldn’t read the response. Please try again.");
    }
    if (!response.ok)
      throw new Error(data.error || "We couldn’t connect. Please try again.");
    return data;
  }

  function scheduleRefresh() {
    clearTimeout(pollTimer);
    if (!document.hidden) pollTimer = setTimeout(load, 15000);
  }

  async function load() {
    if (loading || saving) return;
    loading = true;
    retry.disabled = true;
    const version = ++requestVersion;
    try {
      const data = await api("/api/poll");
      if (version !== requestVersion) return;
      applySnapshot(data);
    } catch {
      if (version !== requestVersion) return;
      setLive(false);
      results.setAttribute("aria-busy", "false");
      if (!poll) {
        rows.innerHTML =
          '<p class="results-error">The family’s results are taking a little longer to arrive. Check your connection, then try again.</p>';
        $("leader-title").textContent = "We’ll be right here";
        $("leader-description").textContent =
          "Connect to load the dates and cast your vote.";
        setStatus(
          "Couldn’t connect. Tap “Try connecting again” in the results below.",
          "error",
        );
      }
    } finally {
      loading = false;
      retry.disabled = false;
      scheduleRefresh();
    }
  }

  form.addEventListener("change", (event) => {
    if (event.target.name !== "date") return;
    draft = event.target.value;
    updateControls();
    defaultStatus();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (
      saving ||
      !poll ||
      !allowedDates.includes(draft) ||
      draft === poll.selectedDate
    )
      return;
    saving = true;
    requestVersion += 1;
    clearTimeout(pollTimer);
    updateControls();
    setStatus("Making your vote count…");
    try {
      const data = await api("/api/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: draft }),
      });
      applySnapshot(data, true);
      showToast("You’re counted. One step closer to getting together.");
    } catch (error) {
      setStatus(
        error.name === "TimeoutError" || error instanceof TypeError
          ? "We couldn’t confirm your vote. Try again; it won’t be counted twice."
          : error.message,
        "error",
      );
      setLive(false);
    } finally {
      saving = false;
      updateControls();
      scheduleRefresh();
    }
  });

  retry.addEventListener("click", load);
  document.addEventListener("visibilitychange", () => {
    clearTimeout(pollTimer);
    if (!document.hidden) load();
  });
  window.addEventListener("online", load);

  document.querySelectorAll("[data-share]").forEach((shareButton) =>
    shareButton.addEventListener("click", async () => {
      const url = `${location.origin}${location.pathname}`;
      try {
        if (navigator.share) {
          await navigator.share({
            title: "Haraka Bulls — A date for all of us",
            text: "Let’s get the family together. Choose your date for our next Haraka Bulls gathering.",
            url,
          });
        } else if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(url);
          showToast("Link copied. Send it to the family!");
        } else {
          showToast(
            "Share this page’s address with your family from your browser.",
          );
        }
      } catch (error) {
        if (error.name !== "AbortError")
          showToast(
            "Use your browser’s share menu to send this page to the family.",
          );
      }
    }),
  );

  const dialog = $("about-dialog");
  $("about-button").addEventListener("click", () => dialog.showModal());
  $("close-dialog").addEventListener("click", () => dialog.close());
  $("got-it").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom
    )
      dialog.close();
  });

  load();
})();
