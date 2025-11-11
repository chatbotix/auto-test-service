const Session = new Map()

const setSession = (sessionId, data) => {
  Session.set(sessionId, data)
}

const updateSession = (sessionId, data) => {
  Session.set(sessionId, { ...Session.get(sessionId), ...data })
}

const getSession = (sessionId) => {
  return Session.get(sessionId)
}

const delSession = (sessionId) => {
  Session.delete(sessionId)
}

module.exports = {
  setSession,
  getSession,
  updateSession,
  delSession,
}