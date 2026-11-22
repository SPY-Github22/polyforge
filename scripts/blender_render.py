import bpy
import sys
import os
import math

def setup_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    # Remove all leftover objects
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)

    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE_NEXT' if hasattr(bpy.types, 'RenderSettings') and 'BLENDER_EEVEE_NEXT' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE'
    scene.render.resolution_x = 1024
    scene.render.resolution_y = 1024
    scene.render.film_transparent = False

    # World background
    world = bpy.data.worlds.new("StudioWorld")
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs[0].default_value = (0.12, 0.13, 0.16, 1.0) # Sleek dark studio gradient
        bg.inputs[1].default_value = 0.8

    # Camera
    cam_data = bpy.data.cameras.new("MainCam")
    cam_data.lens = 52
    cam_obj = bpy.data.objects.new("MainCam", cam_data)
    scene.collection.objects.link(cam_obj)
    scene.camera = cam_obj

    # Studio Lighting: Key, Fill, Rim
    # Key light
    key_data = bpy.data.lights.new("KeyLight", type='AREA')
    key_data.energy = 400
    key_data.size = 2.0
    key_data.color = (1.0, 0.96, 0.92)
    key_obj = bpy.data.objects.new("KeyLight", key_data)
    key_obj.location = (1.8, -2.8, 2.2)
    key_obj.rotation_euler = (math.radians(50), math.radians(15), math.radians(30))
    scene.collection.objects.link(key_obj)

    # Fill light
    fill_data = bpy.data.lights.new("FillLight", type='AREA')
    fill_data.energy = 220
    fill_data.size = 2.8
    fill_data.color = (0.88, 0.93, 1.0)
    fill_obj = bpy.data.objects.new("FillLight", fill_data)
    fill_obj.location = (-2.0, -2.4, 1.5)
    fill_obj.rotation_euler = (math.radians(50), math.radians(-15), math.radians(-30))
    scene.collection.objects.link(fill_obj)

    # Rim light
    rim_data = bpy.data.lights.new("RimLight", type='SPOT')
    rim_data.energy = 450
    rim_data.spot_size = math.radians(70)
    rim_data.color = (1.0, 0.98, 0.95)
    rim_obj = bpy.data.objects.new("RimLight", rim_data)
    rim_obj.location = (0.0, 2.5, 2.4)
    rim_obj.rotation_euler = (math.radians(-135), 0, 0)
    scene.collection.objects.link(rim_obj)

    # Ground shadow plane
    bpy.ops.mesh.primitive_plane_add(size=12, location=(0, 0, 0))
    floor = bpy.context.active_object
    floor_mat = bpy.data.materials.new("FloorMat")
    floor_mat.use_nodes = True
    bsdf = floor_mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs['Base Color'].default_value = (0.08, 0.09, 0.11, 1.0)
        bsdf.inputs['Roughness'].default_value = 0.4
    floor.data.materials.append(floor_mat)

    return cam_obj

def set_camera(cam, loc, rot):
    cam.location = loc
    cam.rotation_euler = (math.radians(rot[0]), math.radians(rot[1]), math.radians(rot[2]))

def render_model(glb_path, renders_config):
    cam = setup_scene()
    
    # Import GLB
    bpy.ops.import_scene.gltf(filepath=glb_path)
    
    for conf in renders_config:
        out_path = conf['output']
        set_camera(cam, conf['cam_pos'], conf['cam_rot'])
        bpy.context.scene.render.filepath = out_path
        bpy.ops.render.render(write_still=True)
        print(f"Rendered: {out_path}")

def main():
    artifacts_dir = '/home/sudpy/Projects/polyforge/artifacts'
    system_artifacts_dir = '/home/sudpy/.gemini/antigravity-cli/brain/8bd8d386-8923-4fdf-beaa-399fc867af7a'
    os.makedirs(artifacts_dir, exist_ok=True)
    os.makedirs(system_artifacts_dir, exist_ok=True)

    configs = [
        # 1. Female Clothed (3/4 and Front)
        {
            'glb': os.path.join(artifacts_dir, 'female_clothed.glb'),
            'renders': [
                {
                    'cam_pos': (1.7, -3.0, 0.90),
                    'cam_rot': (88, 0, 30),
                    'output': os.path.join(artifacts_dir, 'render_female_clothed_threequarter.png'),
                },
                {
                    'cam_pos': (0.0, -3.4, 0.84),
                    'cam_rot': (90, 0, 0),
                    'output': os.path.join(artifacts_dir, 'render_female_clothed_front.png'),
                },
            ]
        },
        # 2. Female Underwear (Front, 3/4, Back showing non-bulky athletic proportions)
        {
            'glb': os.path.join(artifacts_dir, 'female_underwear.glb'),
            'renders': [
                {
                    'cam_pos': (1.7, -3.0, 0.90),
                    'cam_rot': (88, 0, 30),
                    'output': os.path.join(artifacts_dir, 'render_female_underwear_threequarter.png'),
                },
                {
                    'cam_pos': (0.0, -3.4, 0.84),
                    'cam_rot': (90, 0, 0),
                    'output': os.path.join(artifacts_dir, 'render_female_underwear_front.png'),
                },
                {
                    'cam_pos': (0.0, 3.4, 0.84),
                    'cam_rot': (90, 0, 180),
                    'output': os.path.join(artifacts_dir, 'render_female_underwear_back.png'),
                },
            ]
        },
        # 3. Female Bare (Front, Close-up Torso/Neck/Jawline, and 3/4)
        {
            'glb': os.path.join(artifacts_dir, 'female_bare.glb'),
            'renders': [
                {
                    'cam_pos': (0.0, -3.4, 0.84),
                    'cam_rot': (90, 0, 0),
                    'output': os.path.join(artifacts_dir, 'render_female_bare_front.png'),
                },
                {
                    'cam_pos': (0.0, -1.8, 1.30),
                    'cam_rot': (90, 0, 0),
                    'output': os.path.join(artifacts_dir, 'render_female_bare_upperbody.png'),
                },
                {
                    'cam_pos': (1.7, -3.0, 0.90),
                    'cam_rot': (88, 0, 30),
                    'output': os.path.join(artifacts_dir, 'render_female_bare_threequarter.png'),
                },
            ]
        },
        # 4. Male Underwear (Modular skeleton parity)
        {
            'glb': os.path.join(artifacts_dir, 'male_underwear.glb'),
            'renders': [
                {
                    'cam_pos': (1.7, -3.2, 0.95),
                    'cam_rot': (88, 0, 28),
                    'output': os.path.join(artifacts_dir, 'render_male_underwear_threequarter.png'),
                },
            ]
        },
    ]

    for item in configs:
        glb = item['glb']
        print(f"\nProcessing {glb}...")
        render_model(glb, item['renders'])

    # Copy all rendered images into system artifacts dir
    for f in os.listdir(artifacts_dir):
        if f.endswith('.png') or f.endswith('.glb'):
            src = os.path.join(artifacts_dir, f)
            dst = os.path.join(system_artifacts_dir, f)
            with open(src, 'rb') as sf, open(dst, 'wb') as df:
                df.write(sf.read())
            print(f"Copied to system artifacts: {dst}")

if __name__ == '__main__':
    main()
