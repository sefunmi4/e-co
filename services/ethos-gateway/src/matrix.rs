use std::sync::Arc;

use async_trait::async_trait;

use crate::proto::ethos::v1::{Conversation, Message};

#[async_trait]
pub trait MatrixBridge: Send + Sync {
    async fn ensure_room(&self, _conversation: &Conversation) -> anyhow::Result<()> {
        Ok(())
    }

    async fn send_message(
        &self,
        _conversation: &Conversation,
        _message: &Message,
    ) -> anyhow::Result<()> {
        Ok(())
    }
}

pub struct NullMatrixBridge;

#[async_trait]
impl MatrixBridge for NullMatrixBridge {}

#[cfg(feature = "matrix")]
pub struct SdkMatrixBridge {
    client: matrix_sdk::Client,
}

#[cfg(feature = "matrix")]
impl SdkMatrixBridge {
    #[allow(clippy::too_many_arguments)]
    pub async fn new(
        homeserver: &str,
        access_token: &str,
        user_id: &str,
        device_id: &str,
        refresh_token: Option<&str>,
    ) -> anyhow::Result<Self> {
        use matrix_sdk::{
            authentication::{matrix::MatrixSession, SessionTokens},
            ruma::OwnedUserId,
            Client, SessionMeta,
        };

        let client = Client::builder().homeserver_url(homeserver).build().await?;
        let session = MatrixSession {
            meta: SessionMeta {
                user_id: OwnedUserId::try_from(user_id)?,
                device_id: device_id.to_owned().into(),
            },
            tokens: SessionTokens {
                access_token: access_token.to_owned(),
                refresh_token: refresh_token.map(|token| token.to_owned()),
            },
        };
        client.restore_session(session).await?;
        Ok(Self { client })
    }
}

#[cfg(feature = "matrix")]
#[async_trait]
impl MatrixBridge for SdkMatrixBridge {
    async fn ensure_room(&self, conversation: &Conversation) -> anyhow::Result<()> {
        let room_id = match matrix_sdk::ruma::OwnedRoomId::try_from(conversation.id.as_str()) {
            Ok(id) => id,
            Err(_) => return Ok(()),
        };
        if let Some(room) = self.client.get_room(room_id.as_ref()) {
            match room.state() {
                matrix_sdk::RoomState::Joined => return Ok(()),
                matrix_sdk::RoomState::Invited | matrix_sdk::RoomState::Left => {
                    room.join().await?;
                }
                _ => {}
            }
        }
        Ok(())
    }

    async fn send_message(
        &self,
        conversation: &Conversation,
        message: &Message,
    ) -> anyhow::Result<()> {
        use matrix_sdk::ruma::events::room::message::RoomMessageEventContent;
        let room_id = match matrix_sdk::ruma::OwnedRoomId::try_from(conversation.id.as_str()) {
            Ok(id) => id,
            Err(_) => return Ok(()),
        };
        if let Some(room) = self.client.get_room(room_id.as_ref()) {
            if room.state() == matrix_sdk::RoomState::Joined {
                let content = RoomMessageEventContent::text_plain(&message.body);
                room.send(content).await?;
            }
        }
        Ok(())
    }
}

pub async fn matrix_bridge_from_config(
    config: &crate::config::GatewayConfig,
) -> anyhow::Result<Arc<dyn MatrixBridge>> {
    #[cfg(not(feature = "matrix"))]
    let _ = config;
    #[cfg(feature = "matrix")]
    if let Some(matrix) = &config.matrix {
        if let (Some(token), Some(user_id), Some(device_id)) =
            (&matrix.access_token, &matrix.user_id, &matrix.device_id)
        {
            return Ok(Arc::new(
                SdkMatrixBridge::new(
                    &matrix.homeserver,
                    token,
                    user_id,
                    device_id,
                    matrix.refresh_token.as_deref(),
                )
                .await?,
            ));
        } else {
            tracing::warn!("Matrix credentials incomplete; falling back to NullMatrixBridge");
        }
    }
    Ok(Arc::new(NullMatrixBridge))
}
