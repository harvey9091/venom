/**
 * Pulse CRM Realtime Service — socket.io mini service.
 * Port: 3003 (fixed; Caddy forwards from /?XTransformPort=3003)
 *
 * Responsibilities:
 *  - broadcast workspace-scoped events (entity_created, entity_updated, entity_deleted)
 *  - relay notifications between users
 *  - push automation run results
 *
 * Clients join a room per workspaceId and optionally per userId for private notifications.
 */
import { createServer } from 'http'
import { Server } from 'socket.io'

const PORT = 3003

const httpServer = createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ service: 'pulse-realtime', ok: true, ts: Date.now() }))
})

const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  path: '/',
})

interface ClientMeta {
  userId?: string
  workspaceId?: string
}

io.on('connection', (socket) => {
  console.log(`[io] connect ${socket.id}`)

  socket.on('join', (meta: ClientMeta) => {
    if (meta.workspaceId) {
      socket.join(`ws:${meta.workspaceId}`)
      console.log(`[io] ${socket.id} joined ws:${meta.workspaceId}`)
    }
    if (meta.userId) {
      socket.join(`user:${meta.userId}`)
    }
    socket.emit('joined', { ok: true })
  })

  // Broadcast an entity event to the workspace room
  socket.on('entity:event', (payload: { workspaceId: string; type: string; entity: any; action: string }) => {
    if (!payload?.workspaceId) return
    io.to(`ws:${payload.workspaceId}`).emit('entity:event', payload)
  })

  // Send a notification to a specific user
  socket.on('notify:user', (payload: { userId: string; notification: any }) => {
    if (!payload?.userId) return
    io.to(`user:${payload.userId}`).emit('notification', payload.notification)
  })

  // Broadcast activity feed update
  socket.on('activity:new', (payload: { workspaceId: string; activity: any }) => {
    if (!payload?.workspaceId) return
    io.to(`ws:${payload.workspaceId}`).emit('activity:new', payload.activity)
  })

  socket.on('typing', (payload: { workspaceId: string; userId: string; entityId: string }) => {
    if (!payload?.workspaceId) return
    socket.to(`ws:${payload.workspaceId}`).emit('typing', payload)
  })

  socket.on('disconnect', () => {
    console.log(`[io] disconnect ${socket.id}`)
  })
})

httpServer.listen(PORT, () => {
  console.log(`[pulse-realtime] listening on :${PORT}`)
})
