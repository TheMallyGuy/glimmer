<script lang="ts">
  import { SettingGroup, SettingRow, Switch, Dropdown, TextField } from "$lib";
  import { appState } from "$lib/appState.svelte";
  import { getFlagValue, setFlagValue } from "$lib/flags";
  import { _ } from "svelte-i18n";

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
    { value: "-1", label: $_("common.default") },
    { value: "0", label: "0" },
    { value: "1", label: "1" },
    { value: "2", label: "2" },
    { value: "3", label: "3" },
    { value: "4", label: "4" },
  ];
  const graphicsApiItems = [
    { value: "default", label: $_("common.default") },
    { value: "d3d11", label: $_("flagsPresets.graphicsApiDirect3D11") },
    { value: "vulkan", label: $_("flagsPresets.graphicsApiVulkan") },
    { value: "opengl", label: $_("flagsPresets.graphicsApiOpenGL") },
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
  <SettingGroup label={$_("flagsPresets.geometryGroup")}>
    <SettingRow
      title={$_("flagsPresets.lowMeshQuality")}
      description={$_("flagsPresets.lowMeshQualityDescription")}
    >
      {#snippet control()}
        <Switch
          label={$_("flagsPresets.lowMeshQuality")}
          checked={lowMeshQuality}
          onchange={setLowMeshQuality}
        />
      {/snippet}
    </SettingRow>
    <SettingRow
      title={$_("flagsPresets.pauseVoxelizer")}
      description={$_("flagsPresets.pauseVoxelizerDescription")}
    >
      {#snippet control()}
        <Switch
          label={$_("flagsPresets.pauseVoxelizer")}
          checked={pauseVoxelizer}
          onchange={(v) =>
            setFlagValue(flags, VOXELIZER_KEY, v ? "true" : "false")}
        />
      {/snippet}
    </SettingRow>
  </SettingGroup>

  <SettingGroup label={$_("flagsPresets.renderingGroup")}>
    <SettingRow
      title={$_("flagsPresets.preferredGraphicsApi")}
      description={$_("flagsPresets.preferredGraphicsApiDescription")}
    >
      {#snippet control()}
        <Dropdown
          label={$_("flagsPresets.preferredGraphicsApi")}
          size="sm"
          width="160px"
          options={graphicsApiItems}
          value={graphicsApi}
          onchange={setGraphicsApi}
        />
      {/snippet}
    </SettingRow>
    <SettingRow title={$_("flagsPresets.msaaSamples")} description={$_("flagsPresets.msaaSamplesDescription")}>
      {#snippet control()}
        <Dropdown
          label={$_("flagsPresets.msaaSamples")}
          size="sm"
          width="120px"
          options={msaaItems}
          value={msaaSamples}
          onchange={(v) => setFlagValue(flags, MSAA_KEY, v)}
        />
      {/snippet}
    </SettingRow>
    <SettingRow
      title={$_("flagsPresets.textureQualityOverride")}
      description={$_("flagsPresets.textureQualityOverrideDescription")}
    >
      {#snippet control()}
        <Dropdown
          label={$_("flagsPresets.textureQualityOverride")}
          size="sm"
          width="140px"
          options={textureItems}
          value={textureOverride}
          onchange={setTextureOverride}
        />
      {/snippet}
    </SettingRow>
    <SettingRow
      title={$_("flagsPresets.graySky")}
      description={$_("flagsPresets.graySkyDescription")}
    >
      {#snippet control()}
        <Switch
          label={$_("flagsPresets.graySky")}
          checked={graySky}
          onchange={(v) => setFlagValue(flags, SKY_KEY, v ? "true" : "false")}
        />
      {/snippet}
    </SettingRow>
    <SettingRow
      title={$_("flagsPresets.disableDpiScaling")}
      description={$_("flagsPresets.disableDpiScalingDescription")}
    >
      {#snippet control()}
        <Switch
          label={$_("flagsPresets.disableDpiScaling")}
          checked={disableDpiScale}
          onchange={(v) => setFlagValue(flags, DPI_KEY, v ? "true" : "false")}
        />
      {/snippet}
    </SettingRow>
    <SettingRow
      title={$_("flagsPresets.renderQualityLevelOverride")}
      description={$_("flagsPresets.renderQualityLevelOverrideDescription")}
    >
      {#snippet control()}
        <TextField
          label={$_("flagsPresets.renderQualityLevelOverride")}
          class="w-[120px]"
          value={frmQualityOverride}
          oninput={(e) =>
            setFlagValue(flags, FRM_QUALITY_KEY, e.currentTarget.value)}
        />
      {/snippet}
    </SettingRow>
  </SettingGroup>

  <SettingGroup label={$_("flagsPresets.grassGroup")}>
    <SettingRow
      title={$_("flagsPresets.maxGrassDistance")}
      description={$_("flagsPresets.maxGrassDistanceDescription")}
    >
      {#snippet control()}
        <TextField
          label={$_("flagsPresets.maxGrassDistance")}
          class="w-[120px]"
          value={maxGrassDistance}
          oninput={(e) =>
            setFlagValue(flags, MAX_GRASS_KEY, e.currentTarget.value)}
        />
      {/snippet}
    </SettingRow>
    <SettingRow
      title={$_("flagsPresets.minGrassDistance")}
      description={$_("flagsPresets.minGrassDistanceDescription")}
    >
      {#snippet control()}
        <TextField
          label={$_("flagsPresets.minGrassDistance")}
          class="w-[120px]"
          value={minGrassDistance}
          oninput={(e) =>
            setFlagValue(flags, MIN_GRASS_KEY, e.currentTarget.value)}
        />
      {/snippet}
    </SettingRow>
    <SettingRow
      title={$_("flagsPresets.grassMotionFactor")}
      description={$_("flagsPresets.grassMotionFactorDescription")}
    >
      {#snippet control()}
        <TextField
          label={$_("flagsPresets.grassMotionFactor")}
          class="w-[120px]"
          value={grassMotionFactor}
          oninput={(e) =>
            setFlagValue(flags, GRASS_MOTION_KEY, e.currentTarget.value)}
        />
      {/snippet}
    </SettingRow>
  </SettingGroup>

  <SettingGroup label={$_("flagsPresets.windowGroup")}>
    <SettingRow
      title={$_("flagsPresets.handleAltEnter")}
      description={$_("flagsPresets.handleAltEnterDescription")}
    >
      {#snippet control()}
        <Switch
          label={$_("flagsPresets.handleAltEnter")}
          checked={altEnterFullscreen}
          onchange={(v) =>
            setFlagValue(flags, ALT_ENTER_KEY, v ? "true" : "false")}
        />
      {/snippet}
    </SettingRow>
  </SettingGroup>
</div>
