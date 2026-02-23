export interface Profile {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  bio: string | null
  elo_rating: number
  wins: number
  losses: number
  win_streak: number
  total_battles: number
  created_at: string
}

export interface Match {
  id: string
  mode: 'debate' | 'roast'
  topic: string | null
  player_a: string | null
  player_b: string | null
  winner: string | null
  status: 'waiting' | 'live' | 'voting' | 'finished'
  round: 'opening' | 'rapid_fire' | 'closing'
  created_at: string
  finished_at: string | null
  player_a_profile?: Profile
  player_b_profile?: Profile
}

export interface Vote {
  id: string
  match_id: string
  voter_id: string
  voted_for: string
  created_at: string
}

export interface MatchMessage {
  id: string
  match_id: string
  sender_id: string
  content: string
  round: string | null
  created_at: string
  sender?: Profile
}
