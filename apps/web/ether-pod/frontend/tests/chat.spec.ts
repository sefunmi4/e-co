import { test, expect } from '@playwright/test';

test.describe('Ethos guild chat', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const session = {
        token: 'playwright-token',
        userId: 'playwright-user',
        displayName: 'Playwright User',
      };
      const clientFactory = () => {
        const seedTimestamp = Date.now();
        return {
          async listConversations() {
            return {
              conversations: [
                {
                  id: 'guild-1',
                  topic: 'Engineering Guild',
                  updatedAt: seedTimestamp,
                  participants: [
                    {
                      userId: 'mentor',
                      displayName: 'Guild Mentor',
                      avatarUrl: '',
                    },
                    {
                      userId: session.userId,
                      displayName: session.displayName,
                      avatarUrl: '',
                    },
                  ],
                },
              ],
            };
          },
          streamMessages() {
            async function* generator() {
              yield {
                message: {
                  id: 'seed-message',
                  conversationId: 'guild-1',
                  senderId: 'mentor',
                  body: 'Welcome to Ethos!',
                  timestampMs: seedTimestamp,
                },
              };
            }
            return generator();
          },
          streamPresence() {
            async function* generator() {
              yield {
                event: {
                  userId: 'mentor',
                  state: 2,
                  updatedAt: seedTimestamp,
                },
              };
            }
            return generator();
          },
          async sendMessage(request: { conversationId: string; body: string }) {
            return {
              message: {
                id: `playwright-${Date.now()}`,
                conversationId: request.conversationId,
                senderId: session.userId,
                body: request.body,
                timestampMs: Date.now(),
              },
            };
          },
        };
      };
      Object.assign(window as unknown as Record<string, unknown>, {
        __ETHOS_CLIENT_FACTORY__: clientFactory,
        __ETHOS_SESSION__: session,
      });
    });
  });

  test('posts a message to the active guild thread', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText('Engineering Guild')).toBeVisible();
    await expect(page.getByText('Welcome to Ethos!')).toBeVisible();

    await page.getByLabel('Send a message').fill('Hello from Playwright');
    await page.getByRole('button', { name: 'Post' }).click();

    await expect(page.getByText('Hello from Playwright')).toBeVisible();

    await page.getByRole('button', { name: 'Guilds' }).click();
    await expect(page.getByText('Engineering Guild')).toBeVisible();
  });
});
