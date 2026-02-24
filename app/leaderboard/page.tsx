'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Trophy, Flame } from 'lucide-react'

type Player = {
  id: string
  username: string
  display_name: string
  elo_rating: number
  wins: number
  losses: number
  win_streak: number
  total_battles: number
  xp_total: number
}

function getTier(elo: number) {
  if (elo >= 2000) return { label: 'GOAT', color: '#fbbf24' }
  if (elo >= 1600) return { label: 'ELITE', color: '#a855f7' }
  if (elo >= 1300) return { label: 'VET', color: '#3b82f6' }
  if (elo >= 1100) return { label: 'RISING', color: '#ff7a45' }
  return { label: 'ROOKIE', color: '#6b7280' }
}

export default function LeaderboardPage() {
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .order('elo_rating', { ascending: false })
        .limit(100)
      if (data) setPlayers(data)
      setLoading(false)
    }
    fetchData()
  }, [])

  const top3 = players.slice(0, 3)
  const rest = players.slice(3)

  if (loading) {
    return (
      <div style={s.page}>
        <div style={{ textAlign: 'center', paddingTop: 120 }}>
          <Flame size={32} color="#ff7a45" style={{ animation: 'mmq-spin 1s linear infinite' }} />
        </div>
        <style>{`@keyframes mmq-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  return (
    <div style={s.page}>
      <div style={s.container}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div style={s.subtitle}>Rankings</div>
          <h1 style={s.title}>
            <span>The </span>
            <span style={{ background: 'linear-gradient(135deg, #ff4d3d, #ff7a45)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Clout Board
            </span>
          </h1>
        </div>

        {/* Podium */}
        {top3.length > 0 && (
          <div style={s.podium}>
            {/* 2nd */}
            {top3[1] ? (
              <div style={{ ...s.podiumCard, order: 1 }}>
                <div style={{ fontSize: 28, marginBottom: 6 }}>🥈</div>
                <div style={s.podiumName}>{top3[1].display_name}</div>
                <div style={s.podiumUser}>@{top3[1].username}</div>
                <div style={{ ...s.podiumElo, color: 'rgba(255,255,255,.65)' }}>{top3[1].elo_rating}</div>
                <div style={s.podiumRecord}>{top3[1].wins}W - {top3[1].losses}L</div>
              </div>
            ) : <div style={{ order: 1 }} />}

            {/* 1st */}
            {top3[0] && (
              <div style={{ ...s.podiumCard, order: 2, paddingTop: 32 }}>
                <div style={{ fontSize: 32, marginBottom: 6 }}>👑</div>
                <div style={{ ...s.podiumName, fontSize: 15, fontWeight: 900 }}>{top3[0].display_name}</div>
                <div style={s.podiumUser}>@{top3[0].username}</div>
                <div style={{ ...s.podiumElo, color: '#fbbf24', fontSize: 28, textShadow: '0 0 20px rgba(251,191,36,.3)' }}>{top3[0].elo_rating}</div>
                <div style={s.podiumRecord}>{top3[0].wins}W - {top3[0].losses}L</div>
                {top3[0].xp_total > 0 && (
                  <div style={{ color: '#fbbf24', fontSize: 11, fontWeight: 800, marginTop: 4 }}>{top3[0].xp_total.toLocaleString()} XP</div>
                )}
                {top3[0].win_streak > 0 && (
                  <div style={{ color: '#ff7a45', fontSize: 12, fontWeight: 700, marginTop: 4 }}>🔥 {top3[0].win_streak} streak</div>
                )}
              </div>
            )}

            {/* 3rd */}
            {top3[2] ? (
              <div style={{ ...s.podiumCard, order: 3 }}>
                <div style={{ fontSize: 28, marginBottom: 6 }}>🥉</div>
                <div style={s.podiumName}>{top3[2].display_name}</div>
                <div style={s.podiumUser}>@{top3[2].username}</div>
                <div style={{ ...s.podiumElo, color: '#fb923c' }}>{top3[2].elo_rating}</div>
                <div style={s.podiumRecord}>{top3[2].wins}W - {top3[2].losses}L</div>
              </div>
            ) : <div style={{ order: 3 }} />}
          </div>
        )}

        {/* Divider */}
        <div style={{ height: 1, background: 'rgba(255,255,255,.06)', margin: '24px 0' }} />

        {/* Rest */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {rest.map((player, i) => {
            const rank = i + 4
            const tier = getTier(player.elo_rating)
            return (
              <div key={player.id} style={s.row}>
                <span style={s.rank}>{rank}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={s.rowName}>{player.display_name}</span>
                    <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.08em', color: tier.color }}>{tier.label}</span>
                  </div>
                  <span style={s.rowUser}>@{player.username}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={s.rowElo}>{player.elo_rating}</span>
                </div>
                <div style={s.rowStats}>
                  <span style={{ color: 'rgba(34,197,94,.6)', fontSize: 12, fontWeight: 700 }}>{player.wins}W</span>
                  <span style={{ color: 'rgba(255,255,255,.15)', margin: '0 2px' }}>·</span>
                  <span style={{ color: 'rgba(255,77,61,.6)', fontSize: 12, fontWeight: 700 }}>{player.losses}L</span>
                </div>
                <div style={s.rowStreak}>
                  {player.win_streak > 0 ? (
                    <span style={{ color: '#ff7a45', fontSize: 12, fontWeight: 700 }}>🔥{player.win_streak}</span>
                  ) : (
                    <span style={{ color: 'rgba(255,255,255,.10)' }}>—</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {players.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>⚔️</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,.45)' }}>No debaters yet</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,.25)', marginTop: 4 }}>Be the first to claim the board.</div>
          </div>
        )}
      </div>

      <style>{`
        @media (max-width: 480px) {
          .lb-row-stats, .lb-row-streak { display: none !important; }
        }
      `}</style>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh', position: 'relative', zIndex: 1,
    fontFamily: "'Inter', system-ui, sans-serif",
    padding: '0 0 100px',
  },
  container: {
    maxWidth: 640, margin: '0 auto', padding: '32px 16px',
  },
  subtitle: {
    fontSize: 11, fontWeight: 800, letterSpacing: '.14em', color: '#ff4d3d',
    textTransform: 'uppercase' as const, marginBottom: 4,
  },
  title: {
    fontSize: 36, fontWeight: 900, letterSpacing: '-.03em', lineHeight: 1.05,
    color: 'rgba(255,255,255,.92)',
  },
  podium: {
    display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10,
    alignItems: 'end', marginBottom: 8,
  },
  podiumCard: {
    textAlign: 'center' as const, padding: '20px 12px', borderRadius: 16,
    background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)',
  },
  podiumName: {
    color: 'rgba(255,255,255,.90)', fontWeight: 800, fontSize: 13,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
  },
  podiumUser: { color: 'rgba(255,255,255,.25)', fontSize: 11, marginBottom: 6 },
  podiumElo: { fontSize: 22, fontWeight: 900, lineHeight: 1.2 },
  podiumRecord: { fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,.25)', letterSpacing: '.06em', marginTop: 4 },
  row: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '12px 14px', borderRadius: 12,
    background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.04)',
    transition: 'background .15s',
  },
  rank: { width: 28, textAlign: 'center' as const, fontSize: 13, fontWeight: 800, color: 'rgba(255,255,255,.25)' },
  rowName: { color: 'rgba(255,255,255,.85)', fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },
  rowUser: { color: 'rgba(255,255,255,.20)', fontSize: 11 },
  rowElo: { color: 'rgba(255,255,255,.90)', fontWeight: 900, fontSize: 14 },
  rowStats: { textAlign: 'right' as const, width: 70 },
  rowStreak: { width: 40, textAlign: 'center' as const },
}
