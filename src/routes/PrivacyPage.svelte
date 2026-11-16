<script lang="ts">
  import PublicLayout from '$lib/components/public/PublicLayout.svelte';
</script>

<svelte:head>
  <title>Privacy · You Need a Better Budget</title>
</svelte:head>

<PublicLayout>
  <article class="doc">
    <h1>Privacy</h1>
    <p class="updated">Last updated 2026-11-16</p>

    <h2>The short version</h2>
    <p>
      YNBB runs in your browser. We run no server that stores your budget. There are no accounts,
      no analytics and no ads. Your budget is saved in your browser and in a Google Sheet that you own.
    </p>

    <h2>What stays in your browser</h2>
    <p>
      Your budget, accounts, transactions and settings are saved in your browser's local database
      (IndexedDB). Sample data, when you use it, is saved there too. Nothing in that database is sent
      to us.
    </p>

    <h2>Your Google Sheet</h2>
    <p>
      When you connect Google, the app creates a spreadsheet named <code>YNBB Budget</code> in your
      Google Drive. It reads and writes that sheet to keep your budget in sync across devices.
    </p>
    <p>
      The app asks Google for the <code>drive.file</code> permission only. With that permission the app
      can see only the files it creates, or files you open with it. It cannot see the rest of your Drive.
    </p>

    <h2>Google sign-in</h2>
    <p>
      Sign-in runs through Google Identity Services, which is Google's code. Google's privacy policy
      covers what Google does with your sign-in. The access token is kept in memory in your browser and is
      lost when you close the tab. Only its expiry time is stored in your browser's database.
    </p>

    <h2>Hosting</h2>
    <p>
      The site files are served by a hosting provider. That provider may keep standard server logs,
      such as IP addresses, under its own policy. The app adds no tracking to the pages.
    </p>

    <h2>Cookies</h2>
    <p>We set no tracking cookies. See the <a class="link" href="#/cookies">cookies page</a> for details.</p>

    <h2>Your choices</h2>
    <ul>
      <li>Export your transactions to CSV from Settings at any time.</li>
      <li>Clear local data in Settings &gt; Danger zone. This does not change your Google Sheet.</li>
      <li>Delete the <code>YNBB Budget</code> spreadsheet from your Google Drive to remove the sheet.</li>
      <li>Remove the app's access in your Google account settings.</li>
    </ul>

    <h2>Questions</h2>
    <p>
      Open an issue on
      <a class="link" href="https://github.com/chattes/you-need-a-better-budget/issues">GitHub</a>.
    </p>
  </article>
</PublicLayout>
