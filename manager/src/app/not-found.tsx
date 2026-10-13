import Link from 'next/link';

export default function NoEncontrado() {
  return (
    <main className="grid min-h-[60dvh] place-items-center p-6 text-center">
      <div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/icon-192.png" alt="" width={96} height={96} className="mx-auto rounded-3xl" />
        <h1 className="titulo-marca mt-4 text-2xl font-bold">No encontramos esa página</h1>
        <Link href="/" className="mt-4 inline-block font-semibold text-oro-700 underline">Volver al inicio</Link>
      </div>
    </main>
  );
}
