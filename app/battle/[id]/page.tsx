'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Send, Trophy, Clock, Eye, Flame } from 'lucide-react'

type Message = {
  id: string
  content: string
  round: number
  created_at: string
  sender_id: string
  sender: { username: string; display_name: string }
}

type MatchData = {
  id: string
  mode: string
  topic: string
  status: string
  round: number
  player_a: { id: string; username: string; display_name: string; elo_rating: number }
  player_b: { id: string; username: string; display_name: string; elo_rating: number } | null
  winner: { id: string; display_name: string } | null
}

const MAX_ROUNDS = 3
const MAX_CHARS = 500

export default function BattlePage() {
  const { id: matchId } = useParams() as { id: string }

  const [match, setMatch] = useState<MatchData | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [votes, setVotes] = useState<Record<string, number>>({})
  const [myVote, setMyVote] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchAll()
    supabase.from('profiles').select('id').eq('username', 'testplayer2').single()
      .then(({ data }) => { if (data) setCurrentUserId(data.id) })

    const ch1 = supabase.channel(`bm-${matchId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'match_messages', filter: `match_id=eq.${matchId}` }, () => fetchMessages())
      .subscribe()
    const ch2 = supabase.channel(`bu-${matchId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${matchId}` }, () => fetchMatch())
      .subscribe()
    const ch3 = supabase.channel(`bv-${matchId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'votes', filter: `match_id=eq.${matchId}` }, () => fetchVotes())
      .subscribe()

    return () => { [ch1, ch2, ch3].forEach(c => supabase.removeChannel(c)) }
  }, [matchId])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  function fetchAll() { fetchMatch(); fetchMessages(); fetchVotes() }

  async function fetchMatch() {
    const { data } = await supabase.from('matches')
      .select(`id,mode,topic,status,round,
        player_a:profiles!matches_player_a_fkey(id,username,display_name,elo_rating),
        player_b:profiles!matches_player_b_fkey(id,username,display_name,elo_rating),
        winner:profiles!matches_winner_fkey(id,display_name)`)
      .eq('id', matchId).single()
    if (data) setMatch(data as any)
  }

  async function fetchMessages() {
    const { data } = await supabase.from('match_messages')
      .select(`id,content,round,created_at,sender_id,sender:profiles!match_messages_sender_id_fkey(username,display_name)`)
      .eq('match_id', matchId).order('created_at', { ascending: true })
    if (data) setMessages(data as any)
  }

  async function fetchVotes() {
    const { data } = await supabase.from('votes').select('voted_for').eq('match_id', matchId)
    if (data) {
      const c: Record<string, number> = {}
      data.forEach(v => { c[v.voted_for] = (c[v.voted_for] || 0) + 1 })
      setVotes(c)
    }
  }

  async function sendMessage() {
    if (!input.trim() || !match || !currentUserId) return
    await supabase.from('match_messages').insert({
      match_id: matchId, sender_id: currentUserId, content: input.trim(), round: match.round,
    })
    setInput('')
    const { data: rm } = await supabase.from('match_messages').select('sender_id').eq('match_id', matchId).eq('round', match.round)
    if (new Set(rm?.map(m => m.sender_id)).size >= 2) {
      if (match.round >= MAX_ROUNDS) {
        await supabase.from('matches').update({ status: 'finished', finished_at: new Date().toISOString() }).eq('id', matchId)
      } else {
        await supabase.from('matches').update({ round: match.round + 1 }).eq('id', matchId)
      }
    }
  }

  async function castVote(pid: string) {
    if (!currentUserId || myVote) return
    await supabase.from('votes').insert({ match_id: matchId, voter_id: currentUserId, voted_for: pid })
    setMyVote(pid)
    fetchVotes()
  }

  if (!match) return (
    <div style={s.page}>
      <div style={{ textAlign: 'center', paddingTop: 120 }}>
        <Flame size={32} color="#ff7a45" style={{ animation: 'mmq-spin .6s linear infinite' }} />
      </div>
      <style>{`@keyframes mmq-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  const isPlayer = currentUserId === match.player_a?.id || currentUserId === match.player_b?.id
  const isFinished = match.status === 'finished'
  const total = Object.values(votes).reduce((a, b) => a + b, 0)
  const aVotes = match.player_a?.id ? votes[match.player_a.id] || 0 : 0
  const bVotes = match.player_b?.id ? votes[match.player_b.id] || 0 : 0
  const aPct = total > 0 ? Math.round((aVotes / total) * 100) : 50
  const bPct = total > 0 ? Math.round((bVotes / total) * 100) : 50

  return (
    <div style={s.page}>
      <div style={s.container}>
        {/* Header */}
        <div style={s.headerCard}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
            <span style={{
              fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 6,
              background: match.mode === 'debate' ? 'rgba(115,47,109,.15)' : 'rgba(255,77,61,.12)',
              color: match.mode === 'debate' ? '#a855f7' : '#ff7a45',
            }}>
              {match.mode === 'debate' ? '🎙 DEBATE' : '🔥 ROAST'}
            </span>
            {!isFinished ? (
              <span style={{
                fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 6,
                background: 'rgba(34,197,94,.10)', color: '#22c55e',
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: 999, background: '#22c55e' }} />
                Round {match.round}/{MAX_ROUNDS}
              </span>
            ) : (
              <span style={{ fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 6, background: 'rgba(255,255,255,.04)', color: 'rgba(255,255,255,.35)' }}>
                🏁 FINISHED
              </span>
            )}
            {total > 0 && <span style={{ fontSize: 10, color: 'rgba(255,255,255,.20)', marginLeft: 'auto' }}><Eye size={10} /> {total} votes</span>}
          </div>

          <h1 style={{ fontSize: 20, fontWeight: 900, color: 'rgba(255,255,255,.90)', marginBottom: 16, lineHeight: 1.3 }}>{match.topic}</h1>

          {/* VS */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, textAlign: 'right' }}>
              <div style={{ color: '#ff4d3d', fontWeight: 900, fontSize: 16 }}>{match.player_a?.display_name}</div>
              <div style={{ color: 'rgba(255,255,255,.20)', fontSize: 11 }}>{match.player_a?.elo_rating} ELO</div>
            </div>
            <div style={{
              width: 40, height: 40, borderRadius: 999, flexShrink: 0,
              background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)',
              display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 900, color: 'rgba(255,255,255,.35)',
            }}>VS</div>
            <div style={{ flex: 1 }}>
              <div style={{ color: '#3b82f6', fontWeight: 900, fontSize: 16 }}>{match.player_b?.display_name || '...'}</div>
              <div style={{ color: 'rgba(255,255,255,.20)', fontSize: 11 }}>{match.player_b?.elo_rating || '???'} ELO</div>
            </div>
          </div>

          {/* Vote bar */}
          {total > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 800, marginBottom: 4 }}>
                <span style={{ color: '#ff4d3d' }}>{aPct}%</span>
                <span style={{ color: '#3b82f6' }}>{bPct}%</span>
              </div>
              <div style={{ height: 4, background: 'rgba(255,255,255,.04)', borderRadius: 999, overflow: 'hidden', display: 'flex' }}>
                <div style={{ width: `${aPct}%`, background: '#ff4d3d', transition: 'width .5s' }} />
                <div style={{ width: `${bPct}%`, background: '#3b82f6', transition: 'width .5s' }} />
              </div>
            </div>
          )}
        </div>

        {/* Main content — stacks on mobile */}
        <div style={s.grid} className="battle-grid">
          {/* Chat */}
          <div style={s.chatCard}>
            <div style={s.chatArea}>
              {messages.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(255,255,255,.15)' }}>
                  <span style={{ fontSize: 36, marginBottom: 8 }}>⚔️</span>
                  <span style={{ fontSize: 13 }}>Waiting for the first move...</span>
                </div>
              ) : messages.map(msg => {
                const isA = msg.sender_id === match.player_a?.id
                return (
                  <div key={msg.id} style={{ display: 'flex', justifyContent: isA ? 'flex-start' : 'flex-end' }}>
                    <div style={{
                      maxWidth: '80%', padding: '12px 16px', borderRadius: 14,
                      background: isA ? 'rgba(255,77,61,.08)' : 'rgba(59,130,246,.08)',
                      border: `1px solid ${isA ? 'rgba(255,77,61,.12)' : 'rgba(59,130,246,.12)'}`,
                      borderBottomLeftRadius: isA ? 4 : 14,
                      borderBottomRightRadius: isA ? 14 : 4,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: isA ? '#ff4d3d' : '#3b82f6' }}>{msg.sender?.display_name}</span>
                        <span style={{ fontSize: 9, color: 'rgba(255,255,255,.15)' }}>R{msg.round}</span>
                      </div>
                      <p style={{ fontSize: 13, color: 'rgba(255,255,255,.80)', lineHeight: 1.6, margin: 0 }}>{msg.content}</p>
                    </div>
                  </div>
                )
              })}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            {isPlayer && !isFinished && (
              <div style={s.inputBar}>
                <input
                  value={input} onChange={e => setInput(e.target.value.slice(0, MAX_CHARS))}
                  onKeyDown={e => e.key === 'Enter' && sendMessage()}
                  placeholder={match.mode === 'debate' ? 'Make your argument...' : 'Hit them with it...'}
                  style={s.chatInput}
                />
                <button onClick={sendMessage} disabled={!input.trim()} style={{
                  ...s.sendBtn, opacity: !input.trim() ? 0.3 : 1,
                  cursor: !input.trim() ? 'not-allowed' : 'pointer',
                }}>
                  <Send size={14} />
                </button>
              </div>
            )}

            {isFinished && (
              <div style={{ borderTop: '1px solid rgba(255,255,255,.06)', padding: '28px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: 36 }}>🏆</div>
                <div style={{ fontSize: 16, fontWeight: 900, color: 'rgba(255,255,255,.85)', marginTop: 6 }}>Battle Over</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,.30)', marginTop: 4 }}>
                  {match.winner ? `${match.winner.display_name} takes it.` : 'Vote for the winner.'}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar — Vote + Info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Vote */}
            <div style={s.sideCard}>
              <div style={s.sideTitle}>🗳 Cast Your Vote</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { player: match.player_a, color: '#ff4d3d', pct: aPct, count: aVotes },
                  { player: match.player_b, color: '#3b82f6', pct: bPct, count: bVotes },
                ].map(({ player, color, pct, count }) => {
                  if (!player) return null
                  const voted = myVote === player.id
                  return (
                    <button key={player.id} onClick={() => castVote(player.id)} disabled={!!myVote || isPlayer} style={{
                      width: '100%', padding: '14px 16px', borderRadius: 12, textAlign: 'left',
                      border: voted ? `1px solid ${color}33` : '1px solid rgba(255,255,255,.05)',
                      background: voted ? `${color}11` : 'rgba(255,255,255,.02)',
                      cursor: myVote || isPlayer ? 'not-allowed' : 'pointer',
                      fontFamily: 'inherit', transition: 'all .15s',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 800, color }}>{player.display_name}</span>
                        {voted && <span>✅</span>}
                      </div>
                      {total > 0 && (
                        <>
                          <div style={{ height: 3, background: 'rgba(255,255,255,.04)', borderRadius: 999, overflow: 'hidden', marginBottom: 4 }}>
                            <div style={{ height: '100%', background: color, width: `${pct}%`, transition: 'width .5s' }} />
                          </div>
                          <span style={{ fontSize: 10, color: 'rgba(255,255,255,.20)' }}>{count} votes · {pct}%</span>
                        </>
                      )}
                    </button>
                  )
                })}
              </div>
              {isPlayer && <p style={{ fontSize: 10, color: 'rgba(255,255,255,.15)', textAlign: 'center', marginTop: 8 }}>Players can&apos;t vote on their own match</p>}
            </div>

            {/* Info */}
            <div style={s.sideCard}>
              <div style={s.sideTitle}>📋 Info</div>
              {[
                ['Mode', match.mode === 'debate' ? '🎙 Debate' : '🔥 Roast'],
                ['Round', `${match.round} / ${MAX_ROUNDS}`],
                ['Status', match.status.toUpperCase()],
                ['Votes', `${total}`],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 0' }}>
                  <span style={{ color: 'rgba(255,255,255,.20)' }}>{k}</span>
                  <span style={{ color: 'rgba(255,255,255,.65)', fontWeight: 700 }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`@keyframes mmq-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh', position: 'relative', zIndex: 1,
    fontFamily: "'Inter', system-ui, sans-serif", padding: '0 0 100px',
  },
  container: { maxWidth: 900, margin: '0 auto', padding: '24px 16px' },
  headerCard: {
    padding: '20px 22px', borderRadius: 18,
    background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)',
    marginBottom: 16,
  },
  grid: {
    display: 'grid', gridTemplateColumns: '1fr 280px', gap: 14,
  },
  chatCard: {
    borderRadius: 18, overflow: 'hidden',
    background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.05)',
    display: 'flex', flexDirection: 'column',
  },
  chatArea: {
    height: 420, overflowY: 'auto' as const, padding: 16,
    display: 'flex', flexDirection: 'column', gap: 10,
  },
  inputBar: {
    borderTop: '1px solid rgba(255,255,255,.06)', padding: 12,
    display: 'flex', gap: 8,
  },
  chatInput: {
    flex: 1, height: 42, borderRadius: 10,
    background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)',
    color: 'rgba(255,255,255,.92)', fontFamily: 'inherit', fontSize: 13,
    padding: '0 14px', outline: 'none',
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: 10, border: 'none',
    background: 'linear-gradient(135deg, #ff4d3d, #ff7a45)', color: '#fff',
    display: 'grid', placeItems: 'center', cursor: 'pointer',
    transition: 'transform .15s',
  },
  sideCard: {
    padding: '18px 20px', borderRadius: 16,
    background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.05)',
  },
  sideTitle: {
    fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,.30)',
    letterSpacing: '.08em', textTransform: 'uppercase' as const, marginBottom: 12,
  },
}
