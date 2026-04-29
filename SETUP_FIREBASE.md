# Setup Firebase — Chico FC

## 1. Firebase Authentication
No console do Firebase (console.firebase.google.com), vá em:
**Authentication → Sign-in method → Email/Password → Ativar**

## 2. Coleção `players` no Firestore
A coleção passou de `profiles` para `players`. Estrutura de cada documento:

```
/players/{uid}
  name: "João Silva"
  email: "joao@email.com"
  player_type: "mensalista" | "avulso"
  role: "admin" | "player"
  active: true
  created_at: "2025-01-01T00:00:00.000Z"
```

## 3. Regras do Firestore
No console: **Firestore → Rules**, cole isso:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Só usuários autenticados
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## 4. Criar os primeiros admins (você + 2 amigos)

Faça isso via Firebase Console ou via código temporário.

### Via Firebase Console (mais fácil):
1. Vá em **Authentication → Users → Add user**
2. Coloque email e senha
3. Copie o UID gerado
4. Vá em **Firestore → players → Add document**
5. Use o UID como ID do documento
6. Adicione os campos acima com `role: "admin"`

### Após o primeiro admin estar criado:
- Faça login no app com ele
- Use a aba **Admin** (ícone de escudo no menu) para adicionar os outros jogadores

## 5. Coleção `payments` — novo campo `type`
Pagamentos agora têm `type: "mensalidade" | "jogo"`:
- `mensalidade` → R$88/mês para mensalistas
- `jogo` → R$22/jogo para avulsos (gerado automaticamente ao confirmar presença)

## 6. Coleção `attendances` — novos campos
```
/attendances/{id}
  game_id: string
  user_id: string
  player_type: "mensalista" | "avulso"
  status: "confirmed" | "waitlist"
  confirmed_at: string
```

## Resumo da lógica de confirmação
- **Mensalistas** podem confirmar a qualquer momento e entram direto na lista
- **Avulsos** entram na lista de espera até terça-feira às 13:00
- Após esse prazo, avulsos da espera são promovidos automaticamente quando há vaga
- Ao ser confirmado, avulso gera pendência de R$22 na Caixinha
