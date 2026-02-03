'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sparkles } from 'lucide-react'

export default function LoginPage() {
  const { user, loading, signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth()
  const router = useRouter()
  const [isSigningIn, setIsSigningIn] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)

  useEffect(() => {
    if (!loading && user) {
      router.push('/')
    }
  }, [user, loading, router])

  const handleSignIn = async () => {
    setIsSigningIn(true)
    setError(null)
    try {
      await signInWithGoogle()
    } catch (err) {
      setError('Failed to sign in. Please try again.')
      console.error(err)
    } finally {
      setIsSigningIn(false)
    }
  }

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      setError('Please enter email and password')
      return
    }
    setIsSigningIn(true)
    setError(null)
    try {
      if (isSignUp) {
        await signUpWithEmail(email, password)
      } else {
        await signInWithEmail(email, password)
      }
    } catch (err: unknown) {
      const firebaseError = err as { code?: string }
      if (firebaseError.code === 'auth/user-not-found') {
        setError('User not found. Try signing up.')
      } else if (firebaseError.code === 'auth/wrong-password') {
        setError('Wrong password.')
      } else if (firebaseError.code === 'auth/email-already-in-use') {
        setError('Email already in use. Try signing in.')
      } else if (firebaseError.code === 'auth/weak-password') {
        setError('Password should be at least 6 characters.')
      } else {
        setError('Authentication failed. Please try again.')
      }
      console.error(err)
    } finally {
      setIsSigningIn(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-emerald-500" />
      </div>
    )
  }

  if (user) {
    return null
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8 text-center">
        <div className="space-y-4">
          <div className="flex justify-center">
            <div className="p-3 md:p-4 bg-emerald-600/20 rounded-2xl">
              <Sparkles className="h-10 w-10 md:h-12 md:w-12 text-emerald-500" />
            </div>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white">SeeDream</h1>
          <p className="text-zinc-400 text-base md:text-lg">
            AI-powered image generation
          </p>
        </div>

        <div className="space-y-4 pt-6 md:pt-8">
          <form onSubmit={handleEmailAuth} className="space-y-3">
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500"
            />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500"
            />
            <Button
              type="submit"
              disabled={isSigningIn}
              className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
            >
              {isSigningIn ? 'Processing...' : isSignUp ? 'Sign Up' : 'Sign In'}
            </Button>
          </form>

          <button
            type="button"
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-sm text-zinc-400 hover:text-white transition-colors"
          >
            {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
          </button>

          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-700" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-zinc-950 text-zinc-500">or</span>
            </div>
          </div>

          <Button
            onClick={handleSignIn}
            disabled={isSigningIn}
            variant="outline"
            className="w-full h-11 md:h-12 bg-zinc-900 hover:bg-zinc-800 border-zinc-700 text-white font-medium text-sm md:text-base"
          >
            <span className="flex items-center gap-2">
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continue with Google
            </span>
          </Button>

          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}
        </div>

        <p className="text-zinc-500 text-sm pt-8">
          By continuing, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  )
}
