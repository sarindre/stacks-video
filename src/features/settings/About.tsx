import { APP_NAME, APP_VERSION, CREDITS, ISSUES_URL, LICENSE_URL, NOTICES_URL, PRIVACY_URL, REPO_URL, TAGLINE } from '../../lib/about'
import { TmdbCredit } from '../../components/Attribution'
import { desktopPlatform, isDesktopApp, platformName } from '../../lib/desktop'

const link = 'text-accent underline-offset-2 hover:underline'

export function AboutSection() {
  return (
    <section id="about" aria-labelledby="about-h" className="grid gap-4 rounded-xl border border-line bg-surface p-4">
      <div>
        <h2 id="about-h" className="font-display text-lg">
          About {APP_NAME}
        </h2>
        <p className="text-sm text-mute">
          Version {APP_VERSION}
          {isDesktopApp() ? ` · Desktop app${platformName(desktopPlatform()) ? ` for ${platformName(desktopPlatform())}` : ''}` : ''} · {TAGLINE}
        </p>
      </div>

      <div className="grid gap-1 text-sm">
        <h3 className="font-medium">Your privacy</h3>
        <p className="text-mute">
          Your collection stays on this device. There are no accounts, no analytics and no ads, and nothing is sent to the developer. The app only contacts a lookup service below when you use a feature that needs it, using your own key where one is needed.{' '}
          <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer" className={link}>
            Read the privacy statement
          </a>
          .
        </p>
      </div>

      <div className="grid gap-2 text-sm">
        <h3 className="font-medium">Credits</h3>
        <TmdbCredit />
        <ul className="grid gap-1 text-mute">
          {CREDITS.filter((c) => c.name !== 'TMDB').map((c) => (
            <li key={c.name}>
              <a href={c.url} target="_blank" rel="noopener noreferrer" className={link}>
                {c.name}
              </a>{' '}
              · {c.what}
            </li>
          ))}
        </ul>
        <p className="text-xs text-mute">
          Fonts: Bungee and Barlow Condensed (SIL Open Font License). Icons: Lucide.{' '}
          <a href={NOTICES_URL} target="_blank" rel="noopener noreferrer" className={link}>
            Full list of licenses
          </a>
          .
        </p>
      </div>

      <p className="text-sm text-mute">
        Free and open source under the{' '}
        <a href={LICENSE_URL} target="_blank" rel="noopener noreferrer" className={link}>
          MIT License
        </a>
        . The code and the app's own artwork are yours to use and change; the data, logos and fonts credited above keep their own terms.
      </p>

      <p className="text-sm text-mute">
        <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className={link}>
          Project page
        </a>{' '}
        ·{' '}
        <a href={ISSUES_URL} target="_blank" rel="noopener noreferrer" className={link}>
          Report a problem
        </a>
      </p>
    </section>
  )
}
