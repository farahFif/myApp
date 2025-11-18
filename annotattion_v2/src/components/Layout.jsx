export default function Layout({ children }) {
return (
<div className="container">
<header className="header">
<h1>Annotation App</h1>
</header>
<main className="main">{children}</main>
<footer className="footer">GitHub Pages ready · React + Vite</footer>
</div>
)
}