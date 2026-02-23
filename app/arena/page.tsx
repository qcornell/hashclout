'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Match } from '@/lib/types'
import Link from 'next/link'
import { Swords, Eye, Clock, Plus, Loader2 } from 'lucide-react'

export default function ArenaPage() {
  const [mode, setMode] = useState<'debate' | 'roast'>('debate')
  const [topic, setTopic] = useState('')
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    fetchMatches()
    const channel = supabase
      .channel('matches')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => fetchMatches())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  async function fetchMatches() {
    const { data } = await supabase
      .from('matches')
      .select(`*, player_a_profile:profiles!matches_player_a_fkey(*), player_b_profile:profiles!matches_player_b_fkey(*)`)
      .in('status', ['waiting', 'live'])
      .order('created_at', { ascending: false })
    if (data) setMatches(data)
    setLoading(false)
  }

  async function createMatch() {
    if (!topic.trim()) return
    setCreating(true)
    const profileId = localStorage.getItem('profile_id')
    if (!profileId) { alert('Create a profile first!'); setCreating(false); return }
    const { error } = await supabase.from('matches').insert({ mode, topic: topic.trim(), player_a: profileId, status: 'waiting' }).select().single()
    if (error) alert('Error: ' + error.message)
    else setTopic('')
    setCreating(false)
  }

  async function joinMatch(matchId: string) {
    const profileId = localStorage.getItem('profile_id')
    if (!profileId) { alert('Create a profile first!'); return }
    await supabase.from('matches').update({ player_b: profileId, status: 'live' }).eq('id', matchId)
  }

  return (
    <div style={s.page}>
      <div style={s.container}>
        <div style={{ marginBottom: 28 }}>
          <div style={s.subtitle}>Matchmaking</div>
          <h1 style={s.title}>⚔️ The Arena</h1>
        </div>

        {/* Create Match */}
        <div style={s.card}>
          <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 14, color: 'rgba(255,255,255,.85)' }}>Create a Match</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {(['debate', 'roast'] as const).map(m => (
              <button key={m} onClick={() => setMode(m)} style={{
                padding: '8px 16px', borderRadius: 10, fontFamily: 'inherit',
                fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all .15s',
                border: mode === m ? 'none' : '1px solid rgba(255,255,255,.08)',
                background: mode === m
                  ? (m === 'debate' ? 'linear-gradient(135deg, #352161, #732f6d)' : 'linear-gradient(135deg, #ff4d3d, #ff7a45)')
                  : 'rgba(255,255,255,.03)',
                color: mode === m ? '#fff' : 'rgba(255,255,255,.40)',
              }}>
                {m === 'debate' ? '🎯 Debate' : '🔥 Roast'}
              </button>
            ))}
          </div>
          <input
            type="text" placeholder={mode === 'debate' ? 'Enter debate topic...' : 'Enter roast theme...'}
            value={topic} onChange={e => setTopic(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && createMatch()}
            style={s.input}
          />
          <button onClick={createMatch} disabled={creating || !topic.trim()} style={{
            ...s.btn, opacity: creating || !topic.trim() ? 0.4 : 1,
            cursor: creating || !topic.trim() ? 'not-allowed' : 'pointer',
          }}>
            {creating ? <Loader2 size={14} style={{ animation: 'mmq-spin .6s linear infinite' }} /> : <Plus size={14} />}
            {creating ? 'Creating...' : 'Create Match'}
          </button>
        </div>

        {/* Matches */}
        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 14, color: 'rgba(255,255,255,.85)' }}>Open Matches</div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <Loader2 size={24} color="#ff7a45" style={{ animation: 'mmq-spin .6s linear infinite' }} />
            </div>
          ) : matches.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 20px', ...s.card }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>🏟️</div>
              <div style={{ fontSize: 14, color: 'rgba(255,255,255,.40)', fontWeight: 600 }}>No matches yet. Create one above! 👆</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {matches.map(match => (
                <div key={match.id} style={s.matchCard}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 6,
                        background: match.mode === 'debate' ? 'rgba(115,47,109,.15)' : 'rgba(255,77,61,.12)',
                        color: match.mode === 'debate' ? '#a855f7' : '#ff7a45',
                      }}>
                        {match.mode === 'debate' ? '🎯 DEBATE' : '🔥 ROAST'}
                      </span>
                      <span style={{
                        fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 6,
                        background: match.status === 'waiting' ? 'rgba(251,191,36,.10)' : 'rgba(34,197,94,.10)',
                        color: match.status === 'waiting' ? '#fbbf24' : '#22c55e',
                        display: 'flex', alignItems: 'center', gap: 4,
                      }}>
                        {match.status === 'waiting' ? <><Clock size={10} /> WAITING</> : <><span style={{ width: 6, height: 6, borderRadius: 999, background: '#22c55e', display: 'inline-block' }} /> LIVE</>}
                      </span>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,.85)', marginBottom: 2 }}>{match.topic}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,.25)' }}>
                      by {(match as any).player_a_profile?.username || 'Unknown'}
                    </div>
                  </div>
                  <div style={{ flexShrink: 0 }}>
                    {match.status === 'waiting' ? (
                      <button onClick={() => joinMatch(match.id)} style={{
                        padding: '10px 18px', borderRadius: 10, border: 'none',
                        background: 'rgba(34,197,94,.15)', color: '#22c55e',
                        fontFamily: 'inherit', fontSize: 12, fontWeight: 800, cursor: 'pointer',
                        transition: 'background .15s',
                      }}>
                        Join ⚡
                      </button>
                    ) : (
                      <Link href={`/arena/${match.id}`} style={{
                        padding: '10px 18px', borderRadius: 10, display: 'inline-flex', alignItems: 'center', gap: 6,
                        background: 'rgba(255,77,61,.12)', color: '#ff7a45', textDecoration: 'none',
                        fontSize: 12, fontWeight: 800,
                      }}>
                        <Eye size={13} /> Watch
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`@keyframes mmq-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh', position: 'relative', zIndex: 1,
    fontFamily: "'Inter', system-ui, sans-serif",
    padding: '0 0 100px',
  },
  container: { maxWidth: 640, margin: '0 auto', padding: '32px 16px' },
  subtitle: {
    fontSize: 11, fontWeight: 800, letterSpacing: '.14em', color: '#ff4d3d',
    textTransform: 'uppercase' as const, marginBottom: 4,
  },
  title: { fontSize: 30, fontWeight: 900, letterSpacing: '-.02em', color: 'rgba(255,255,255,.92)' },
  card: {
    padding: '20px 22px', borderRadius: 16,
    background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)',
  },
  input: {
    width: '100%', height: 46, borderRadius: 10, marginBottom: 12,
    background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)',
    color: 'rgba(255,255,255,.92)', fontFamily: 'inherit', fontSize: 14,
    padding: '0 14px', outline: 'none',
  },
  btn: {
    display: 'inline-flex', alignItems: 'center', gap: 8,
    padding: '12px 22px', borderRadius: 12, border: 'none',
    background: 'linear-gradient(135deg, #352161, #732f6d)', color: '#fff',
    fontFamily: 'inherit', fontSize: 13, fontWeight: 800,
    boxShadow: '0 10px 30px rgba(115,47,109,.2)',
    transition: 'transform .15s',
  },
  matchCard: {
    display: 'flex', alignItems: 'center', gap: 14,
    padding: '16px 18px', borderRadius: 14,
    background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.06)',
  },
}
