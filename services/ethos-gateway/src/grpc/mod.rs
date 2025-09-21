use std::{pin::Pin, sync::Arc};

use async_stream::stream;
use futures::{Stream, StreamExt};
use tokio_stream::wrappers::{BroadcastStream, TcpListenerStream};
use tonic::{transport::Server, Request, Response, Status};

use crate::{
    auth,
    proto::ethos::v1::conversations_service_server::{
        ConversationsService, ConversationsServiceServer,
    },
    proto::ethos::v1::{
        CreateConversationRequest, CreateConversationResponse, ListConversationsRequest,
        ListConversationsResponse, SendMessageRequest, SendMessageResponse, StreamMessagesRequest,
        StreamMessagesResponse, StreamPresenceRequest, StreamPresenceResponse,
    },
    services::ChatEvent,
    state::AppState,
};

pub struct ConversationsGrpc {
    state: Arc<AppState>,
}

impl ConversationsGrpc {
    pub fn new(state: Arc<AppState>) -> Self {
        Self { state }
    }

    #[allow(clippy::result_large_err)]
    fn authorize(&self, request: &Request<impl Sized>) -> Result<auth::Claims, Status> {
        let token = request
            .metadata()
            .get("authorization")
            .and_then(|value| value.to_str().ok())
            .and_then(|value| value.strip_prefix("Bearer "))
            .ok_or(Status::unauthenticated("missing authorization"))?;
        auth::decode_token(&self.state.config.jwt_secret, token)
            .map_err(|_| Status::unauthenticated("invalid token"))
    }
}

#[tonic::async_trait]
impl ConversationsService for ConversationsGrpc {
    type StreamMessagesStream =
        Pin<Box<dyn Stream<Item = Result<StreamMessagesResponse, Status>> + Send + 'static>>;
    type StreamPresenceStream =
        Pin<Box<dyn Stream<Item = Result<StreamPresenceResponse, Status>> + Send + 'static>>;

    async fn list_conversations(
        &self,
        request: Request<ListConversationsRequest>,
    ) -> Result<Response<ListConversationsResponse>, Status> {
        let claims = self.authorize(&request)?;
        let conversations = self
            .state
            .room_service
            .list_conversations(&claims.sub)
            .await
            .map_err(|error| Status::internal(error.to_string()))?;
        Ok(Response::new(ListConversationsResponse { conversations }))
    }

    async fn create_conversation(
        &self,
        request: Request<CreateConversationRequest>,
    ) -> Result<Response<CreateConversationResponse>, Status> {
        let claims = self.authorize(&request)?;
        let mut user_ids = request.into_inner().participant_user_ids;
        if !user_ids.contains(&claims.sub) {
            user_ids.push(claims.sub.clone());
        }
        let conversation = self
            .state
            .room_service
            .create_conversation(user_ids, None)
            .await
            .map_err(|error| Status::internal(error.to_string()))?;
        let _ = self.state.matrix.ensure_room(&conversation).await;
        Ok(Response::new(CreateConversationResponse {
            conversation: Some(conversation),
        }))
    }

    async fn send_message(
        &self,
        request: Request<SendMessageRequest>,
    ) -> Result<Response<SendMessageResponse>, Status> {
        let claims = self.authorize(&request)?;
        let inner = request.into_inner();
        let message = self
            .state
            .room_service
            .append_message(&inner.conversation_id, &claims.sub, &inner.body)
            .await
            .map_err(|error| Status::internal(error.to_string()))?;
        if let Ok(Some(conversation)) = self
            .state
            .room_service
            .get_conversation(&inner.conversation_id)
            .await
        {
            let _ = self
                .state
                .matrix
                .send_message(&conversation, &message)
                .await;
        }
        if let Ok(payload) = serde_json::to_vec(&ChatEvent::Message(message.clone())) {
            let _ = self
                .state
                .publisher
                .publish(&format!("ethos.chat.{}", inner.conversation_id), &payload)
                .await;
        }
        Ok(Response::new(SendMessageResponse {
            message: Some(message),
        }))
    }

    async fn stream_messages(
        &self,
        request: Request<StreamMessagesRequest>,
    ) -> Result<Response<Self::StreamMessagesStream>, Status> {
        let claims = self.authorize(&request)?;
        let inner = request.into_inner();
        let conversations = self
            .state
            .room_service
            .list_conversations(&claims.sub)
            .await
            .map_err(|error| Status::internal(error.to_string()))?;
        if !conversations.iter().any(|c| c.id == inner.conversation_id) {
            return Err(Status::permission_denied("not a participant"));
        }
        let history = self
            .state
            .room_service
            .history(&inner.conversation_id)
            .await
            .map_err(|error| Status::internal(error.to_string()))?;
        let receiver = self
            .state
            .room_service
            .subscribe(&inner.conversation_id)
            .await
            .ok_or_else(|| Status::not_found("conversation not found"))?;
        let mut stream = BroadcastStream::new(receiver);

        let output = stream! {
            for message in history {
                yield Ok(StreamMessagesResponse { message: Some(message) });
            }
            while let Some(event) = stream.next().await {
                if let Ok(ChatEvent::Message(message)) = event {
                    yield Ok(StreamMessagesResponse { message: Some(message) });
                }
            }
        };

        Ok(Response::new(Box::pin(output) as Self::StreamMessagesStream))
    }

    async fn stream_presence(
        &self,
        request: Request<StreamPresenceRequest>,
    ) -> Result<Response<Self::StreamPresenceStream>, Status> {
        let _claims = self.authorize(&request)?;
        let snapshot = self.state.room_service.presence_snapshot().await;
        let receiver = self.state.room_service.subscribe_presence().await;
        let mut stream = BroadcastStream::new(receiver);
        let user_filter = request.into_inner().user_ids;

        let output = stream! {
            for event in snapshot {
                if user_filter.is_empty() || user_filter.contains(&event.user_id) {
                    yield Ok(StreamPresenceResponse { event: Some(event) });
                }
            }
            while let Some(event) = stream.next().await {
                if let Ok(presence) = event {
                    if user_filter.is_empty() || user_filter.contains(&presence.user_id) {
                        yield Ok(StreamPresenceResponse { event: Some(presence) });
                    }
                }
            }
        };

        Ok(Response::new(Box::pin(output) as Self::StreamPresenceStream))
    }
}

pub async fn serve(
    listener: tokio::net::TcpListener,
    state: Arc<AppState>,
) -> Result<(), anyhow::Error> {
    let grpc = ConversationsGrpc::new(state);
    Server::builder()
        .add_service(ConversationsServiceServer::new(grpc))
        .serve_with_incoming(TcpListenerStream::new(listener))
        .await?;
    Ok(())
}
