import { Link } from 'react-router-dom'
import './Navbar.css'

export default function Navbar() {
    return (
        <nav className="navbar">
            <div className="navbar-brand">
                <Link to="/">leesahm</Link>
            </div>
            <ul className="navbar-links">
                <li><Link to="/">About</Link></li>
                <li><Link to="/gallery">Gallery</Link></li>
                <li><Link to="/editor">Editor</Link></li>
            </ul>
        </nav>
    )
}
