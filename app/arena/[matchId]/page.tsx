export default function LiveMatch({ params }: { params: { matchId: string } }) {
  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <h1 className="text-4xl font-bold mb-2">Live Match</h1>
      <p className="text-gray-500 mb-8">Match ID: {params.matchId}</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Player 1 */}
        <div className="p-6 bg-arena-card rounded-xl border border-arena-accent text-center">
          <div className="text-5xl mb-2">🎤</div>
          <h2 className="text-xl font-semibold">Player 1</h2>
          <p className="text-gray-500">ELO: 1200</p>
        </div>

        {/* Center: Timer + Topic */}
        <div className="p-6 bg-arena-card rounded-xl border border-gray-800 flex flex-col items-center justify-center">
          <p className="text-gray-400 text-sm mb-2">TOPIC</p>
          <h3 className="text-lg font-bold mb-4">Is AI going to replace developers?</h3>
          <div className="text-4xl font-mono text-arena-fire">2:00</div>
        </div>

        {/* Player 2 */}
        <div className="p-6 bg-arena-card rounded-xl border border-arena-fire text-center">
          <div className="text-5xl mb-2">🎤</div>
          <h2 className="text-xl font-semibold">Player 2</h2>
          <p className="text-gray-500">ELO: 1350</p>
        </div>
      </div>

      {/* Vote Panel Placeholder */}
      <div className="mt-8 p-6 bg-arena-card rounded-xl border border-gray-800 text-center">
        <p className="text-gray-400">Vote panel will go here</p>
      </div>

      {/* Chat Placeholder */}
      <div className="mt-4 p-6 bg-arena-card rounded-xl border border-gray-800">
        <p className="text-gray-400">Live chat will go here</p>
      </div>
    </div>
  );
}
