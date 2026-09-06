import { type FormEvent, type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { LogIn, LogOut } from 'lucide-react'
import { BrandSignature } from './BrandSignature'
import { getSupabaseClient } from '../lib/supabase'

type AuthState = 'booting' | 'anonymous' | 'authenticating' | 'authenticated' | 'unauthorized' | 'verification-error' | 'configuration-error'

export function AuthGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>('booting')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [accountEmail, setAccountEmail] = useState('')
  const [error, setError] = useState('')
  const stateRef = useRef<AuthState>('booting')
  const mountedRef = useRef(true)
  const authorizedUserIdRef = useRef<string | null>(null)
  const pendingUserIdRef = useRef<string | null>(null)
  const client = getSupabaseClient()

  const transition = useCallback((next: AuthState) => {
    stateRef.current = next
    if (mountedRef.current) setState(next)
  }, [])

  const verifyAccess = useCallback(async (session: Session, mode: 'restore' | 'sign-in' = 'restore') => {
    if (!client) return
    const userId = session.user.id
    setAccountEmail(session.user.email || '')

    if (authorizedUserIdRef.current === userId) {
      if (stateRef.current !== 'authenticated') transition('authenticated')
      return
    }
    if (pendingUserIdRef.current === userId) return

    const replacingUser = Boolean(authorizedUserIdRef.current && authorizedUserIdRef.current !== userId)
    if (stateRef.current !== 'authenticated' || replacingUser) {
      transition(mode === 'sign-in' ? 'authenticating' : 'booting')
    }
    pendingUserIdRef.current = userId
    const { data: isAdmin, error: accessError } = await client.rpc('pulso_is_admin')
    if (!mountedRef.current || pendingUserIdRef.current !== userId) return
    pendingUserIdRef.current = null

    if (accessError) {
      setError('Não foi possível validar o acesso. Verifique a conexão e tente novamente.')
      if (stateRef.current !== 'authenticated' || replacingUser) transition('verification-error')
      return
    }
    if (isAdmin === true) {
      authorizedUserIdRef.current = userId
      setError('')
      transition('authenticated')
      return
    }
    authorizedUserIdRef.current = null
    transition('unauthorized')
  }, [client, transition])

  useEffect(() => {
    mountedRef.current = true
    if (!client) {
      transition('configuration-error')
      return () => { mountedRef.current = false }
    }

    const { data: listener } = client.auth.onAuthStateChange((event, session) => {
      window.setTimeout(() => {
        if (!mountedRef.current) return
        if (event === 'SIGNED_OUT') {
          authorizedUserIdRef.current = null
          pendingUserIdRef.current = null
          transition('anonymous')
          return
        }
        if (!session) {
          if (event === 'INITIAL_SESSION' && stateRef.current === 'booting') transition('anonymous')
          return
        }
        if (event === 'TOKEN_REFRESHED' && authorizedUserIdRef.current === session.user.id) return
        void verifyAccess(session)
      }, 0)
    })

    void client.auth.getSession().then(({ data: { session }, error: sessionError }) => {
      if (!mountedRef.current) return
      if (sessionError) {
        setError('Não foi possível restaurar a sessão. Verifique a conexão e tente novamente.')
        if (stateRef.current !== 'authenticated') transition('verification-error')
        return
      }
      if (session) void verifyAccess(session)
      else if (stateRef.current === 'booting') transition('anonymous')
    })

    return () => {
      mountedRef.current = false
      listener.subscription.unsubscribe()
    }
  }, [client, transition, verifyAccess])

  const signIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!client || state === 'authenticating') return
    setError('')
    transition('authenticating')
    const { data, error: signInError } = await client.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    if (signInError) {
      setError('E-mail ou senha incorretos.')
      transition('anonymous')
      return
    }
    if (data.session) await verifyAccess(data.session, 'sign-in')
  }

  const signOut = async () => {
    if (!client) return
    await client.auth.signOut()
    authorizedUserIdRef.current = null
    pendingUserIdRef.current = null
    setPassword('')
    transition('anonymous')
  }

  const retrySession = async () => {
    if (!client) return
    setError('')
    transition('booting')
    const { data: { session }, error: sessionError } = await client.auth.getSession()
    if (sessionError) {
      setError('Não foi possível restaurar a sessão. Verifique a conexão e tente novamente.')
      transition('verification-error')
      return
    }
    if (!session) {
      transition('anonymous')
      return
    }
    await verifyAccess(session)
  }

  if (state === 'authenticated') {
    const showSignOut = !['/display', '/input'].includes(window.location.pathname.replace(/\/+$/, '') || '/')
    return (
      <>
        {children}
        {showSignOut && <button className="auth-signout" onClick={() => void signOut()}><LogOut size={15} /> Sair</button>}
      </>
    )
  }

  return (
    <main className="auth-page">
      <section className="auth-shell">
        <BrandSignature />
        <div className="auth-heading">
          <span className="eyebrow">Rede Neural ao Vivo</span>
          <h1>{state === 'booting' ? 'Retomando sessão' : state === 'authenticating' ? 'Verificando acesso' : state === 'unauthorized' ? 'Conta sem acesso' : state === 'verification-error' ? 'Conexão interrompida' : 'Entrar'}</h1>
        </div>

        {state === 'booting' || state === 'authenticating' ? (
          <div className="auth-loading"><i /> {state === 'booting' ? 'Restaurando seu acesso…' : 'Validando credenciais…'}</div>
        ) : state === 'configuration-error' ? (
          <p className="auth-error">A conexão com o Supabase não está configurada neste ambiente.</p>
        ) : state === 'verification-error' ? (
          <div className="auth-denied">
            <p>{error}</p>
            <button className="button button-secondary" onClick={() => void retrySession()}>Tentar novamente</button>
          </div>
        ) : state === 'unauthorized' ? (
          <div className="auth-denied">
            <p><strong>{accountEmail}</strong> está autenticado, mas não pertence à lista de administradores.</p>
            <button className="button button-secondary" onClick={() => void signOut()}><LogOut size={17} /> Sair</button>
          </div>
        ) : (
          <form className="auth-form" onSubmit={(event) => void signIn(event)}>
            <label>
              <span>E-mail</span>
              <input type="email" autoComplete="username" autoFocus required value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            <label>
              <span>Senha</span>
              <input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
            </label>
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button className="button button-primary auth-submit" type="submit"><LogIn size={18} /> Entrar</button>
          </form>
        )}
      </section>
    </main>
  )
}
