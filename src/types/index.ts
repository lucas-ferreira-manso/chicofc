export interface Profile {
  id: string
  email: string
  name: string
  player_type: 'mensalista' | 'avulso'
  role: 'admin' | 'player'
  active: boolean
  created_at: string
}

export interface Game {
  id: string
  title: string
  date: string
  location: string
  max_players: number
  created_by: string
  status: 'upcoming' | 'done' | 'cancelled'
  created_at: string
}

export interface Attendance {
  id: string
  game_id: string
  user_id: string
  status: 'confirmed' | 'waitlist' | 'declined'
  player_type: 'mensalista' | 'avulso'
  confirmed_at: string
  profile?: Profile
}

export interface Payment {
  id: string
  user_id: string
  amount: number
  month: string
  type: 'mensalidade' | 'jogo' | 'despesa'
  game_id?: string
  paid: boolean
  paid_at?: string
  profile?: Profile
}