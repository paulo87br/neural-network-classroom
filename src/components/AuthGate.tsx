import { type FormEvent, type ReactNode, useCallback, useEffect, useState } from 'react'
import { LogIn, LogOut } from 'lucide-react'
import { BrandSignature } from './BrandSignature'
import { getSupabaseClient } from '../lib/supabase'

type AuthState = 'loading' | 'anonymous' | 'checking' | 'authenticated' | 'unauthorized' | 'configuration-error'

export function AuthGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>('loading')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [accountEmail, setAccountEmail] = useState('')
  const [error, setError] = useState('')
  const client = getSupabaseClient()

  const verifyAccess = useCallback(async () => {
    if (!client) {
      setState('configuration-error')
      return
    }
    const { data: { user }, error: userError } = await client.auth.getUser()
    if (userError || !user) {
      setState('anonymous')
      return
    }
    setAccountEmail(user.email || '')
    setState('checking')
    const { data: isAdmin, error: accessError } = await client.rpc('pulso_is_admin')
    setState(!accessError && isAdmin === true ? 'authenticated' : 'unauthorized')
  }, [client])

  useEffect(() => {
    void verifyAccess()
    if (!client) return
    const { data: listener } = client.auth.onAuthStateChange(() => {
      window.setTimeout(() => void verifyAccess(), 0)
    })
    return () => listener.subscription.unsubscribe()
  }, [client, verifyAccess])

  const signIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!client || state === 'checking') return
    setError('')
    setState('checking')
    const { error: signInError } = await client.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    if (signInError) {
      setError('E-mail ou senha incorretos.')
      setState('anonymous')
      return
    }
    await verifyAccess()
  }

  const signOut = async () => {
    if (!client) return
    await client.auth.signOut()
    setPassword('')
    setState('anonymous')
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
          <h1>{state === 'unauthorized' ? 'Conta sem acesso' : 'Entrar'}</h1>
        </div>

        {state === 'loading' || state === 'checking' ? (
          <div className="auth-loading"><i /> Verificando acesso…</div>
        ) : state === 'configuration-error' ? (
          <p className="auth-error">A conexão com o Supabase não está configurada neste ambiente.</p>
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
