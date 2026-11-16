<script lang="ts">
  import PublicLayout from '$lib/components/public/PublicLayout.svelte';
</script>

<svelte:head>
  <title>Cookies · You Need a Better Budget</title>
</svelte:head>

<PublicLayout>
  <article class="doc">
    <h1>Cookies</h1>
    <p class="updated">Last updated 2026-11-16</p>

    <h2>No tracking cookies</h2>
    <p>
      YNBB sets no cookies for tracking, advertising or analytics. There is no analytics code on the pages.
    </p>

    <h2>What we store instead</h2>
    <ul>
      <li>Your budget and settings, in your browser's local database (IndexedDB).</li>
      <li>A few small browser settings, in localStorage, such as a device ID and a one-time notice.</li>
    </ul>
    <p>None of this is sent to us. It is needed to run the app.</p>

    <h2>Google sign-in</h2>
    <p>
      When you sign in with Google, Google may set its own cookies on Google's sites. Google's cookie
      policy covers those.
    </p>

    <h2>Clearing it</h2>
    <p>
      Clear this site's data in your browser settings to remove everything the app stores on your device.
      Your Google Sheet is not affected by that.
    </p>
  </article>
</PublicLayout>
