function App() {
  // Erreur volontaire pour tester la CI : un nombre n'est pas un texte
  const titre: string = 42
  return (
    <main>
      <h1>MiniJira</h1>
      <p>{titre}</p>
    </main>
  )
}

export default App
