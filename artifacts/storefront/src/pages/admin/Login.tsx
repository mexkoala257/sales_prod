import { useState } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/context/AuthContext';
import { useLoginAdmin } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui';
import { Button, Input, Label } from '@/components/ui';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  
  const loginMutation = useLoginAdmin();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    loginMutation.mutate({ data: { email, password } }, {
      onSuccess: (data) => {
        login(data.token, data.user);
        setLocation('/admin/dashboard');
      },
      onError: () => {
        setError('Invalid credentials');
      }
    });
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-zinc-100">
      <Card className="w-full max-w-md border shadow-xl rounded-none bg-white">
        <CardHeader className="space-y-4 pb-6 border-b">
          <div>
            <CardTitle className="text-2xl font-bold tracking-tight">Store Operator Login</CardTitle>
            <CardDescription className="text-zinc-500 mt-1">Access your store dashboard</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && <div className="text-red-600 text-sm font-medium bg-red-50 p-3 border border-red-200">{error}</div>}
            <div className="space-y-2">
              <Label className="text-zinc-700 font-semibold text-xs uppercase tracking-wider">Email Address</Label>
              <Input 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                required 
                className="rounded-none h-11 border-zinc-300 focus-visible:ring-zinc-900" 
              />
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-700 font-semibold text-xs uppercase tracking-wider">Password</Label>
              <Input 
                type="password" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                required 
                className="rounded-none h-11 border-zinc-300 focus-visible:ring-zinc-900"
              />
            </div>
            <Button 
              type="submit" 
              disabled={loginMutation.isPending}
              className="w-full h-11 rounded-none bg-zinc-900 text-white hover:bg-zinc-800 font-semibold transition-colors"
            >
              {loginMutation.isPending ? 'Authenticating...' : 'Sign In'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
