import bpy
import math
import os

bpy.ops.wm.read_factory_settings(use_empty=True)

glb_path = "/home/sudpy/Downloads/PolyForge-Animated-Cyclist.glb"
bpy.ops.import_scene.gltf(filepath=glb_path)

# Set world background
world = bpy.data.worlds.new("StudioWorld")
bpy.context.scene.world = world
world.use_nodes = True
bg_node = world.node_tree.nodes.get("Background")
if bg_node:
    bg_node.inputs[0].default_value = (0.95, 0.95, 0.96, 1.0)
    bg_node.inputs[1].default_value = 1.0

# Add ground plane
bpy.ops.mesh.primitive_plane_add(size=20.0, location=(0, 0, 0))
floor = bpy.context.active_object
floor.name = "Floor"
floor_mat = bpy.data.materials.new(name="FloorMat")
floor_mat.use_nodes = True
bsdf = floor_mat.node_tree.nodes.get("Principled BSDF")
if bsdf:
    bsdf.inputs["Base Color"].default_value = (0.90, 0.90, 0.92, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.5
floor.data.materials.append(floor_mat)

# Lighting
key = bpy.data.lights.new(name="Key", type='SUN')
key.energy = 4.0
key_obj = bpy.data.objects.new("Key", key)
bpy.context.scene.collection.objects.link(key_obj)
key_obj.rotation_euler = (math.radians(50), math.radians(20), math.radians(45))

fill = bpy.data.lights.new(name="Fill", type='SUN')
fill.energy = 2.0
fill_obj = bpy.data.objects.new("Fill", fill)
bpy.context.scene.collection.objects.link(fill_obj)
fill_obj.rotation_euler = (math.radians(40), math.radians(-30), math.radians(-60))

cam_data = bpy.data.cameras.new("Camera")
cam_data.lens = 50
cam = bpy.data.objects.new("Camera", cam_data)
bpy.context.scene.collection.objects.link(cam)
bpy.context.scene.camera = cam

target = bpy.data.objects.new("Target", None)
bpy.context.scene.collection.objects.link(target)

track = cam.constraints.new(type='TRACK_TO')
track.target = target
track.track_axis = 'TRACK_NEGATIVE_Z'
track.up_axis = 'UP_Y'

bpy.context.scene.render.resolution_x = 900
bpy.context.scene.render.resolution_y = 700

artifact_dir = "/home/sudpy/.gemini/antigravity-cli/brain/8bd8d386-8923-4fdf-beaa-399fc867af7a"

views = [
    ("cyclist_side.png", (0.0, -2.6, 0.75), (0.0, 0.0, 0.75)),
    ("cyclist_front_iso.png", (1.8, -1.8, 1.2), (0.1, 0.0, 0.75)),
    ("cyclist_hoods_closeup.png", (1.0, -0.8, 1.15), (0.50, 0.0, 0.95)),
    ("cyclist_pedals_closeup.png", (0.5, -1.0, 0.35), (0.0, 0.0, 0.30)),
]

for out_name, cam_pos, target_pos in views:
    cam.location = cam_pos
    target.location = target_pos
    bpy.context.view_layer.update()
    
    out_path = os.path.join(artifact_dir, out_name)
    bpy.context.scene.render.filepath = out_path
    bpy.ops.render.render(write_still=True)
    print(f"Rendered {out_path}")
