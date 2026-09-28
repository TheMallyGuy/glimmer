<script lang="ts">
  import { SettingGroup, SettingRow, Switch, Dropdown, TextField } from "$lib";
  import { appState } from "$lib/appState.svelte";
  import { getFlagValue, setFlagValue } from "$lib/flags";

  const flags = appState.fastflags.flags;

  const CSG_KEYS = [
    { key: "DFIntCSGLevelOfDetailSwitchingDistance", off: "250" },
    { key: "DFIntCSGLevelOfDetailSwitchingDistanceL12", off: "500" },
    { key: "DFIntCSGLevelOfDetailSwitchingDistanceL23", off: "750" },
    { key: "DFIntCSGLevelOfDetailSwitchingDistanceL34", off: "1000" },
  ] as const;
  const TEXTURE_ENABLED_KEY = "DFFlagTextureQualityOverrideEnabled";
  const TEXTURE_OVERRIDE_KEY = "DFIntTextureQualityOverride";
  const MSAA_KEY = "FIntDebugForceMSAASamples";
  const DPI_KEY = "DFFlagDisableDPIScale";
  const D3D11_KEY = "FFlagDebugGraphicsPreferD3D11";
  const VULKAN_KEY = "FFlagDebugGraphicsPreferVulkan";
  const OPENGL_KEY = "FFlagDebugGraphicsPreferOpenGL";
  const SKY_KEY = "FFlagDebugSkyGray";
  const VOXELIZER_KEY = "DFFlagDebugPauseVoxelizer";
  const FRM_QUALITY_KEY = "DFIntDebugFRMQualityLevelOverride";
  const MAX_GRASS_KEY = "FIntFRMMaxGrassDistance";
  const MIN_GRASS_KEY = "FIntFRMMinGrassDistance";
  const GRASS_MOTION_KEY = "FIntGrassMovementReducedMotionFactor";
  const ALT_ENTER_KEY = "FFlagHandleAltEnterFullscreenManually";

  const msaaItems = [
    { value: "0", label: "x0" },
    { value: "1", label: "x1" },
    { value: "2", label: "x2" },
    { value: "4", label: "x4" },
    { value: "8", label: "x8" },
  ];
  const textureItems = [
    { value: "-1", label: "Default" },
    { value: "0", label: "0" },
    { value: "1", label: "1" },
    { value: "2", label: "2" },
    { value: "3", label: "3" },
    { value: "4", label: "4" },
  ];
  const graphicsApiItems = [
    { value: "default", label: "Default" },
    { value: "d3d11", label: "Direct3D 11" },
    { value: "vulkan", label: "Vulkan" },
    { value: "opengl", label: "OpenGL" },
  ];

  const altEnterFullscreen = $derived(
    getFlagValue(flags, ALT_ENTER_KEY) === "true",
  );
  const lowMeshQuality = $derived(
    CSG_KEYS.every((k) => (getFlagValue(flags, k.key) ?? k.off) === "0"),
  );
  const textureOverride = $derived(
    getFlagValue(flags, TEXTURE_ENABLED_KEY) === "true"
      ? (getFlagValue(flags, TEXTURE_OVERRIDE_KEY) ?? "3")
      : "-1",
  );
  const msaaSamples = $derived(getFlagValue(flags, MSAA_KEY) ?? "0");
  const disableDpiScale = $derived(getFlagValue(flags, DPI_KEY) === "true");
  const graphicsApi = $derived(
    getFlagValue(flags, D3D11_KEY) === "true"
      ? "d3d11"
      : getFlagValue(flags, VULKAN_KEY) === "true"
        ? "vulkan"
        : getFlagValue(flags, OPENGL_KEY) === "true"
          ? "opengl"
          : "default",
  );
  const graySky = $derived(getFlagValue(flags, SKY_KEY) === "true");

  const pauseVoxelizer = $derived(
    getFlagValue(flags, VOXELIZER_KEY) === "true",
  );
  const frmQualityOverride = $derived(
    getFlagValue(flags, FRM_QUALITY_KEY) ?? "0",
  );
  const maxGrassDistance = $derived(
    getFlagValue(flags, MAX_GRASS_KEY) ?? "290",
  );
  const minGrassDistance = $derived(
    getFlagValue(flags, MIN_GRASS_KEY) ?? "100",
  );
  const grassMotionFactor = $derived(
    getFlagValue(flags, GRASS_MOTION_KEY) ?? "5",
  );

  function setLowMeshQuality(on: boolean) {
    for (const k of CSG_KEYS) setFlagValue(flags, k.key, on ? "0" : k.off);
  }

  function setTextureOverride(v: string) {
    if (v === "-1") {
      setFlagValue(flags, TEXTURE_ENABLED_KEY, "false");
    } else {
      setFlagValue(flags, TEXTURE_ENABLED_KEY, "true");
      setFlagValue(flags, TEXTURE_OVERRIDE_KEY, v);
    }
  }

  function setGraphicsApi(v: string) {
    setFlagValue(flags, D3D11_KEY, v === "d3d11" ? "true" : "false");
    setFlagValue(flags, VULKAN_KEY, v === "vulkan" ? "true" : "false");
    setFlagValue(flags, OPENGL_KEY, v === "opengl" ? "true" : "false");
  }
</script>

<div class="flex flex-col gap-0.5">
  <SettingGroup label="Geometry">
    <SettingRow
      title="Low mesh quality"
      description="Switch to lower-detail CSG meshes sooner, at every distance."
    >
      {#snippet control()}
        <Switch
          label="Low mesh quality"
          checked={lowMeshQuality}
          onchange={setLowMeshQuality}
        />
      {/snippet}
    </SettingRow>
    <SettingRow
      title="Pause voxelizer"
      description="Stop terrain/CSG voxelization while it's running."
    >
      {#snippet control()}
        <Switch
          label="Pause voxelizer"
          checked={pauseVoxelizer}
          onchange={(v) =>
            setFlagValue(flags, VOXELIZER_KEY, v ? "true" : "false")}
        />
      {/snippet}
    </SettingRow>
  </SettingGroup>

  <SettingGroup label="Rendering">
    <SettingRow
      title="Preferred graphics API"
      description="Force a specific rendering backend instead of Roblox's own choice."
    >
      {#snippet control()}
        <Dropdown
          label="Preferred graphics API"
          size="sm"
          width="160px"
          options={graphicsApiItems}
          value={graphicsApi}
          onchange={setGraphicsApi}
        />
      {/snippet}
    </SettingRow>
    <SettingRow title="MSAA samples" description="Anti-aliasing sample count.">
      {#snippet control()}
        <Dropdown
          label="MSAA samples"
          size="sm"
          width="120px"
          options={msaaItems}
          value={msaaSamples}
          onchange={(v) => setFlagValue(flags, MSAA_KEY, v)}
        />
      {/snippet}
    </SettingRow>
    <SettingRow
      title="Texture quality override"
      description="Force a texture quality level instead of Roblox's automatic setting."
    >
      {#snippet control()}
        <Dropdown
          label="Texture quality override"
          size="sm"
          width="140px"
          options={textureItems}
          value={textureOverride}
          onchange={setTextureOverride}
        />
      {/snippet}
    </SettingRow>
    <SettingRow
      title="Gray sky"
      description="Replace the sky with flat gray, for debugging or lower-end GPUs."
    >
      {#snippet control()}
        <Switch
          label="Gray sky"
          checked={graySky}
          onchange={(v) => setFlagValue(flags, SKY_KEY, v ? "true" : "false")}
        />
      {/snippet}
    </SettingRow>
    <SettingRow
      title="Disable DPI scaling"
      description="Render at 1:1 pixel scale, ignoring Windows display scaling."
    >
      {#snippet control()}
        <Switch
          label="Disable DPI scaling"
          checked={disableDpiScale}
          onchange={(v) => setFlagValue(flags, DPI_KEY, v ? "true" : "false")}
        />
      {/snippet}
    </SettingRow>
    <SettingRow
      title="Render quality level override"
      description="Force render manager (FRM) quality level, 0 for automatic."
    >
      {#snippet control()}
        <TextField
          label="Render quality level override"
          class="w-[120px]"
          value={frmQualityOverride}
          oninput={(e) =>
            setFlagValue(flags, FRM_QUALITY_KEY, e.currentTarget.value)}
        />
      {/snippet}
    </SettingRow>
  </SettingGroup>

  <SettingGroup label="Grass">
    <SettingRow
      title="Max grass render distance"
      description="Studs from the camera grass keeps rendering out to."
    >
      {#snippet control()}
        <TextField
          label="Max grass render distance"
          class="w-[120px]"
          value={maxGrassDistance}
          oninput={(e) =>
            setFlagValue(flags, MAX_GRASS_KEY, e.currentTarget.value)}
        />
      {/snippet}
    </SettingRow>
    <SettingRow
      title="Min grass render distance"
      description="Studs from the camera grass always renders within."
    >
      {#snippet control()}
        <TextField
          label="Min grass render distance"
          class="w-[120px]"
          value={minGrassDistance}
          oninput={(e) =>
            setFlagValue(flags, MIN_GRASS_KEY, e.currentTarget.value)}
        />
      {/snippet}
    </SettingRow>
    <SettingRow
      title="Grass movement reduced-motion factor"
      description="Scales down how much grass sways; higher is stiller."
    >
      {#snippet control()}
        <TextField
          label="Grass movement reduced-motion factor"
          class="w-[120px]"
          value={grassMotionFactor}
          oninput={(e) =>
            setFlagValue(flags, GRASS_MOTION_KEY, e.currentTarget.value)}
        />
      {/snippet}
    </SettingRow>
  </SettingGroup>

  <SettingGroup label="Window">
    <SettingRow
      title="Handle Alt+Enter fullscreen manually"
      description="Let Roblox itself handle the Alt+Enter fullscreen toggle."
    >
      {#snippet control()}
        <Switch
          label="Handle Alt+Enter fullscreen manually"
          checked={altEnterFullscreen}
          onchange={(v) =>
            setFlagValue(flags, ALT_ENTER_KEY, v ? "true" : "false")}
        />
      {/snippet}
    </SettingRow>
  </SettingGroup>
</div>
