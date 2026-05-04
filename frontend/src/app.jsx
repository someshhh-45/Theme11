import UploadPage from './pages/upload.jsx'

export default function App() {
	return (
		<div className="min-h-screen bg-white">
			<header className="border-b">
				<div className="mx-auto max-w-5xl px-4 py-4">
					<h1 className="text-lg font-semibold">theme11</h1>
				</div>
			</header>

			<main className="mx-auto max-w-5xl px-4 py-6">
				<UploadPage />
			</main>
		</div>
	)
}
