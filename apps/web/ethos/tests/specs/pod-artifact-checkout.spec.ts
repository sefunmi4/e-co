import { expect, test } from "@playwright/test";
import { demoStorefrontData } from "../fixtures/demoData";
import { buildStorefrontMarkup } from "../fixtures/storefrontMarkup";

const formatCurrency = (valueCents: number, currency: string) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(valueCents / 100);

test.describe("Ethos storefront happy path", () => {
  test("navigates from pod to artifact checkout success", async ({ page }) => {
    await page.setContent(buildStorefrontMarkup(demoStorefrontData), {
      waitUntil: "domcontentloaded",
    });

    const targetPod = demoStorefrontData.pods.find(
      (pod) => pod.slug === "synth-garden-lab",
    );
    const targetArtifact = demoStorefrontData.artifacts.find(
      (artifact) => artifact.podId === (targetPod?.id ?? ""),
    );
    if (!targetPod || !targetArtifact) {
      throw new Error("Missing deterministic pod or artifact fixture");
    }

    await expect(page.getByRole("heading", { name: "Choose a pod to explore" })).toBeVisible();
    await page.getByRole("button", { name: targetPod.title }).click();

    await expect(page.getByRole("heading", { name: `${targetPod.title} artifacts` })).toBeVisible();
    await page.getByRole("button", { name: targetArtifact.title }).click();

    await expect(page.getByRole("heading", { name: targetArtifact.title })).toBeVisible();
    await expect(page.getByText(`Crafted by ${targetArtifact.madeBy}`)).toBeVisible();
    await expect(
      page.getByText(formatCurrency(targetArtifact.priceCents, targetArtifact.currency)),
    ).toBeVisible();

    await page.getByRole("button", { name: "Start checkout" }).click();

    await expect(page.getByRole("heading", { name: "Confirm checkout" })).toBeVisible();
    await expect(
      page.getByText(
        `Purchasing ${targetArtifact.title} from ${targetPod.title}. Delivery: ${targetArtifact.deliveryEstimate}.`,
      ),
    ).toBeVisible();

    await expect(page.locator('[data-test="subtotal"]')).toHaveText(
      formatCurrency(demoStorefrontData.checkout.totals.subtotalCents, targetArtifact.currency),
    );
    await expect(page.locator('[data-test="fees"]')).toHaveText(
      formatCurrency(demoStorefrontData.checkout.totals.feesCents, targetArtifact.currency),
    );
    await expect(page.locator('[data-test="total"]')).toHaveText(
      formatCurrency(demoStorefrontData.checkout.totals.totalCents, targetArtifact.currency),
    );

    await page.getByRole("button", { name: "Complete order" }).click();

    const successPanel = page.locator('[data-test="checkout-success"]');
    await expect(successPanel).toHaveClass(/visible/);
    await expect(page.locator('[data-test="success-headline"]')).toHaveText(
      demoStorefrontData.checkout.successHeadline,
    );
    await expect(page.locator('[data-test="success-message"]')).toHaveText(
      demoStorefrontData.checkout.successMessage,
    );
    await expect(page.locator('[data-test="success-note"]')).toHaveText(
      demoStorefrontData.checkout.receiptNote,
    );
  });
});
