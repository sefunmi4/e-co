import {
  EVENT_ARTIFACT_VIEWED,
  EVENT_CHECKOUT_STARTED,
  EVENT_POD_ENTERED,
  EVENT_SALE_COMPLETED,
} from "../../../../../shared/events/web";
import type { DemoStorefrontData } from "./demoData";

const formatCurrencyScript = `
  const formatCurrency = (valueCents, currency) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(valueCents / 100);
  };
`;

const POD_ENTERED_TYPE = JSON.stringify(EVENT_POD_ENTERED);
const ARTIFACT_VIEWED_TYPE = JSON.stringify(EVENT_ARTIFACT_VIEWED);
const CHECKOUT_STARTED_TYPE = JSON.stringify(EVENT_CHECKOUT_STARTED);
const SALE_COMPLETED_TYPE = JSON.stringify(EVENT_SALE_COMPLETED);

export const buildStorefrontMarkup = (data: DemoStorefrontData) => `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Ethos pods checkout flow</title>
    <style>
      :root {
        font-family: "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: #0f172a;
        background: #f8fafc;
      }
      body {
        margin: 0;
        min-height: 100vh;
        display: flex;
        align-items: stretch;
        justify-content: center;
        padding: 32px;
      }
      main, section {
        max-width: 960px;
        width: 100%;
        background: white;
        border-radius: 16px;
        box-shadow: 0 20px 60px rgba(15, 23, 42, 0.12);
        padding: 32px;
      }
      h1, h2, h3 {
        margin-top: 0;
      }
      .pod-grid {
        display: grid;
        gap: 16px;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        margin-top: 24px;
      }
      .pod-card,
      .artifact-card,
      .action-button {
        border: 1px solid rgba(15, 23, 42, 0.08);
        background: linear-gradient(145deg, #fff, #f8fafc);
        border-radius: 12px;
        padding: 20px;
        text-align: left;
        cursor: pointer;
        transition: transform 120ms ease, box-shadow 120ms ease;
      }
      .pod-card:hover,
      .artifact-card:hover,
      .action-button:hover {
        transform: translateY(-2px);
        box-shadow: 0 14px 30px rgba(15, 23, 42, 0.14);
      }
      .pod-card h2,
      .artifact-card h3 {
        font-size: 1.1rem;
        margin-bottom: 8px;
      }
      .muted {
        color: #475569;
        font-size: 0.95rem;
      }
      .artifact-layout {
        display: grid;
        gap: 24px;
        grid-template-columns: minmax(220px, 280px) minmax(0, 1fr);
        margin-top: 24px;
      }
      .artifact-actions,
      .checkout-actions {
        margin-top: 24px;
        display: flex;
        gap: 12px;
      }
      .action-button {
        background: #0f172a;
        color: white;
        font-weight: 600;
        font-size: 1rem;
      }
      .action-secondary {
        background: transparent;
        color: #0f172a;
      }
      .success-panel {
        border-radius: 12px;
        padding: 20px;
        background: linear-gradient(135deg, #22c55e, #4ade80);
        color: #064e3b;
        margin-top: 16px;
        display: none;
      }
      .success-panel.visible {
        display: block;
      }
      .totals-list {
        list-style: none;
        padding: 0;
        margin: 16px 0;
      }
      .totals-list li {
        display: flex;
        justify-content: space-between;
        padding: 6px 0;
        border-bottom: 1px dashed rgba(15, 23, 42, 0.1);
      }
    </style>
  </head>
  <body>
    <main data-view="pods">
      <header>
        <h1>Choose a pod to explore</h1>
        <p class="muted">Each pod curates living artifacts, production notes, and checkout-ready drops.</p>
      </header>
      <div class="pod-grid" data-test="pod-grid"></div>
    </main>

    <section data-view="artifacts" hidden>
      <header>
        <button type="button" class="action-button action-secondary" data-action="back-to-pods">Back to pods</button>
        <h1 data-test="pod-title">Pod artifacts</h1>
        <p class="muted" data-test="pod-subtitle"></p>
      </header>
      <div class="artifact-layout">
        <div data-test="artifact-list"></div>
        <article data-test="artifact-detail">
          <h2>Select an artifact</h2>
          <p class="muted">Review the synopsis, pricing, and delivery expectations before heading to checkout.</p>
        </article>
      </div>
    </section>

    <section data-view="checkout" hidden>
      <header>
        <button type="button" class="action-button action-secondary" data-action="back-to-artifacts">Back to artifacts</button>
        <h1>Confirm checkout</h1>
        <p class="muted" data-test="checkout-summary"></p>
      </header>
      <ul class="totals-list">
        <li><span>Subtotal</span><span data-test="subtotal"></span></li>
        <li><span>Platform fees</span><span data-test="fees"></span></li>
        <li><strong>Total due</strong><strong data-test="total"></strong></li>
      </ul>
      <div class="checkout-actions">
        <button type="button" class="action-button" data-action="complete-checkout">Complete order</button>
      </div>
      <div class="success-panel" data-test="checkout-success">
        <h2 data-test="success-headline"></h2>
        <p data-test="success-message"></p>
        <p data-test="success-note"></p>
      </div>
    </section>

    <script type="application/json" id="playwright-seed">${JSON.stringify(data)}</script>
    <script>
      (function () {
        ${formatCurrencyScript}
        const state = {
          pods: [],
          artifacts: [],
          checkout: ${JSON.stringify(data.checkout)},
          selectedPod: null,
          selectedArtifact: null,
        };
        const seed = JSON.parse(document.getElementById("playwright-seed").textContent);
        state.pods = seed.pods;
        state.artifacts = seed.artifacts;

        const views = {
          pods: document.querySelector('[data-view="pods"]'),
          artifacts: document.querySelector('[data-view="artifacts"]'),
          checkout: document.querySelector('[data-view="checkout"]'),
        };
        const podGrid = document.querySelector('[data-test="pod-grid"]');
        const podTitle = document.querySelector('[data-test="pod-title"]');
        const podSubtitle = document.querySelector('[data-test="pod-subtitle"]');
        const artifactList = document.querySelector('[data-test="artifact-list"]');
        const artifactDetail = document.querySelector('[data-test="artifact-detail"]');
        const checkoutSummary = document.querySelector('[data-test="checkout-summary"]');
        const subtotalEl = document.querySelector('[data-test="subtotal"]');
        const feesEl = document.querySelector('[data-test="fees"]');
        const totalEl = document.querySelector('[data-test="total"]');
        const successPanel = document.querySelector('[data-test="checkout-success"]');
        const successHeadline = document.querySelector('[data-test="success-headline"]');
        const successMessage = document.querySelector('[data-test="success-message"]');
        const successNote = document.querySelector('[data-test="success-note"]');

        const analyticsEndpoint = '/api/analytics/events';
        const dispatchAnalyticsEvent = (event) => {
          try {
            const payload = JSON.stringify({ events: [event] });
            if (navigator && typeof navigator.sendBeacon === 'function') {
              const blob = new Blob([payload], { type: 'application/json' });
              if (navigator.sendBeacon(analyticsEndpoint, blob)) {
                return;
              }
            }
            if (typeof fetch === 'function') {
              fetch(analyticsEndpoint, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: payload,
                keepalive: true,
              }).catch(() => {});
            }
          } catch (error) {
            if (window.console && window.console.warn) {
              window.console.warn('analytics dispatch failed', error);
            }
          }
        };

        const emitPodEntered = (podId) => {
          if (!podId) {
            return;
          }
          dispatchAnalyticsEvent({
            type: ${POD_ENTERED_TYPE},
            pod_id: podId,
            occurred_at: new Date().toISOString(),
          });
        };

        const emitArtifactViewed = (artifactId, podId) => {
          if (!artifactId) {
            return;
          }
          dispatchAnalyticsEvent({
            type: ${ARTIFACT_VIEWED_TYPE},
            artifact_id: artifactId,
            pod_id: podId || null,
            occurred_at: new Date().toISOString(),
          });
        };

        const emitCheckoutStarted = (artifactId, podId) => {
          if (!artifactId) {
            return;
          }
          dispatchAnalyticsEvent({
            type: ${CHECKOUT_STARTED_TYPE},
            artifact_ids: [artifactId],
            pod_id: podId || null,
            occurred_at: new Date().toISOString(),
          });
        };

        const emitSaleCompleted = (artifactId, podId) => {
          if (!artifactId) {
            return;
          }
          const orderId =
            typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
              ? crypto.randomUUID()
              : `order-${Date.now()}`;
          dispatchAnalyticsEvent({
            type: ${SALE_COMPLETED_TYPE},
            order_id: orderId,
            artifact_id: artifactId,
            pod_id: podId || null,
            occurred_at: new Date().toISOString(),
          });
        };

        const hideAll = () => {
          Object.values(views).forEach((view) => {
            view.setAttribute('hidden', 'true');
          });
        };

        const showView = (name) => {
          hideAll();
          const target = views[name];
          if (target) {
            target.removeAttribute('hidden');
          }
        };

        const renderPods = () => {
          podGrid.innerHTML = '';
          state.pods.forEach((pod) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'pod-card';
            button.dataset.action = 'select-pod';
            button.dataset.podId = pod.id;
            button.innerHTML = `
              <h2>${pod.title}</h2>
              <p class="muted">${pod.subtitle}</p>
              <p>${pod.description}</p>
            `;
            podGrid.appendChild(button);
          });
        };

        const renderArtifacts = (podId) => {
          const pod = state.pods.find((item) => item.id === podId);
          state.selectedPod = pod || null;
          const relatedArtifacts = state.artifacts.filter((artifact) => artifact.podId === podId);
          podTitle.textContent = pod ? `${pod.title} artifacts` : 'Pod artifacts';
          podSubtitle.textContent = pod ? pod.subtitle : '';
          artifactList.innerHTML = '';
          relatedArtifacts.forEach((artifact) => {
            const card = document.createElement('button');
            card.type = 'button';
            card.className = 'artifact-card';
            card.dataset.action = 'select-artifact';
            card.dataset.artifactId = artifact.id;
            card.innerHTML = `
              <h3>${artifact.title}</h3>
              <p class="muted">${artifact.summary}</p>
              <p><strong>${formatCurrency(artifact.priceCents, artifact.currency)}</strong> • ${artifact.deliveryEstimate}</p>
            `;
            artifactList.appendChild(card);
          });
          artifactDetail.innerHTML = `
            <h2>Select an artifact</h2>
            <p class="muted">Choose an artifact to preview details and start the checkout flow.</p>
          `;
        };

        const renderArtifactDetail = (artifactId) => {
          const artifact = state.artifacts.find((item) => item.id === artifactId);
          state.selectedArtifact = artifact || null;
          if (!artifact) {
            return;
          }
          artifactDetail.innerHTML = `
            <h2>${artifact.title}</h2>
            <p class="muted">Crafted by ${artifact.madeBy}</p>
            <p>${artifact.summary}</p>
            <p><strong>${formatCurrency(artifact.priceCents, artifact.currency)}</strong> • ${artifact.deliveryEstimate}</p>
            <div class="artifact-actions">
              <button type="button" class="action-button" data-action="start-checkout">Start checkout</button>
            </div>
          `;
          emitArtifactViewed(artifact.id, state.selectedPod ? state.selectedPod.id : null);
        };

        const renderCheckout = () => {
          if (!state.selectedPod || !state.selectedArtifact) {
            return;
          }
          const artifact = state.selectedArtifact;
          const pod = state.selectedPod;
          checkoutSummary.textContent = `Purchasing ${artifact.title} from ${pod.title}. Delivery: ${artifact.deliveryEstimate}.`;
          subtotalEl.textContent = formatCurrency(state.checkout.totals.subtotalCents, artifact.currency);
          feesEl.textContent = formatCurrency(state.checkout.totals.feesCents, artifact.currency);
          totalEl.textContent = formatCurrency(state.checkout.totals.totalCents, artifact.currency);
          successPanel.classList.remove('visible');
        };

        renderPods();
        showView('pods');

        document.addEventListener('click', (event) => {
          const target = event.target as HTMLElement | null;
          if (!target) {
            return;
          }
          const action = target.closest('[data-action]');
          if (!action) {
            return;
          }
          event.preventDefault();
          const name = action.getAttribute('data-action');
          switch (name) {
            case 'select-pod': {
              const podId = action.getAttribute('data-pod-id');
              if (podId) {
                renderArtifacts(podId);
                showView('artifacts');
                emitPodEntered(podId);
              }
              break;
            }
            case 'back-to-pods': {
              showView('pods');
              break;
            }
            case 'select-artifact': {
              const artifactId = action.getAttribute('data-artifact-id');
              if (artifactId) {
                renderArtifactDetail(artifactId);
              }
              break;
            }
            case 'start-checkout': {
              renderCheckout();
              showView('checkout');
              if (state.selectedArtifact) {
                emitCheckoutStarted(
                  state.selectedArtifact.id,
                  state.selectedPod ? state.selectedPod.id : null,
                );
              }
              break;
            }
            case 'back-to-artifacts': {
              showView('artifacts');
              break;
            }
            case 'complete-checkout': {
              successHeadline.textContent = state.checkout.successHeadline;
              successMessage.textContent = state.checkout.successMessage;
              successNote.textContent = state.checkout.receiptNote;
              successPanel.classList.add('visible');
              if (state.selectedArtifact) {
                emitSaleCompleted(
                  state.selectedArtifact.id,
                  state.selectedPod ? state.selectedPod.id : null,
                );
              }
              break;
            }
          }
        });
      })();
    </script>
  </body>
</html>`;
