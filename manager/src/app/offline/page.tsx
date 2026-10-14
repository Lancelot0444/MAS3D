export const metadata = { title: 'Sin conexión' };

export default function Offline() {
  return (
    <main className="grid min-h-dvh place-items-center p-6 text-center">
      <div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/icon-192.png" alt="" width={96} height={96} className="mx-auto rounded-3xl" />
        <h1 className="titulo-marca mt-4 text-2xl font-bold">Sin conexión</h1>
        <p className="mt-2 text-tinta-3">Revisa tu internet. Cuando vuelva la conexión, recarga la página.</p>
      </div>
    </main>
  );
}
