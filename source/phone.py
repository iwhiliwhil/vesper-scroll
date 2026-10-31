import bpy
import bmesh
import math
import os
import sys

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
MODE = argv[0] if argv else "preview"
OUT = argv[1] if len(argv) > 1 else "/tmp/vesper"
HERE = os.path.dirname(os.path.abspath(__file__))

W, H, D = 0.75, 1.55, 0.085
CORNER = 0.115

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


def hexrgb(h, a=1.0):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((x / 12.92) if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4) for x in c) + (a,)


def node(mat, t):
    return next(n for n in mat.node_tree.nodes if n.type == t)


def principled(name, color, metal=0.0, rough=0.4, coat=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = node(m, "BSDF_PRINCIPLED")
    p.inputs["Base Color"].default_value = hexrgb(color)
    p.inputs["Metallic"].default_value = metal
    p.inputs["Roughness"].default_value = rough
    if "Coat Weight" in p.inputs:
        p.inputs["Coat Weight"].default_value = coat
    return m


def rounded_slab(name, w, h, d, r, segs=18):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=(w, d, h), verts=bm.verts)
    ys = [e for e in bm.edges if abs(e.verts[0].co.y - e.verts[1].co.y) > d * 0.5]
    bmesh.ops.bevel(bm, geom=ys, offset=r, segments=segs, affect="EDGES", profile=0.5)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    scene.collection.objects.link(ob)
    return ob


def planar_uv(ob, w, h):
    me = ob.data
    uv = me.uv_layers.new(name="UV")
    for poly in me.polygons:
        for li in poly.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            uv.data[li].uv = ((co.x + w / 2) / w, (co.z + h / 2) / h)


def smooth(ob, angle=35):
    for p in ob.data.polygons:
        p.use_smooth = True
    mod = ob.modifiers.new("Smooth", "NODES") if False else None
    try:
        bpy.context.view_layer.objects.active = ob
        ob.select_set(True)
        bpy.ops.object.shade_smooth_by_angle(angle=math.radians(angle))
        ob.select_set(False)
    except Exception as e:
        print("smooth fallback", e)


def build_phone(name, screen_png):
    root = bpy.data.objects.new(name, None)
    scene.collection.objects.link(root)

    body = rounded_slab(name + "_body", W, H, D, CORNER)
    bev = body.modifiers.new("rim", "BEVEL")
    bev.limit_method = "ANGLE"
    bev.angle_limit = math.radians(40)
    bev.width = 0.016
    bev.segments = 5
    body.data.materials.append(principled("titanium", "#2A2C33", metal=1.0, rough=0.3))
    smooth(body)
    body.parent = root

    glass = rounded_slab(name + "_glass", W - 0.018, H - 0.018, 0.004, CORNER - 0.009)
    glass.location = (0, -D / 2 - 0.001, 0)
    gm = principled("glass_black", "#020309", rough=0.05, coat=1.0)
    glass.data.materials.append(gm)
    smooth(glass)
    glass.parent = root

    sw, sh = W - 0.06, H - 0.06
    screen = rounded_slab(name + "_screen", sw, sh, 0.002, CORNER - 0.03)
    screen.location = (0, -D / 2 - 0.0035, 0)
    planar_uv(screen, sw, sh)
    sm = bpy.data.materials.new("screen_" + name)
    sm.use_nodes = True
    nt = sm.node_tree
    p = node(sm, "BSDF_PRINCIPLED")
    p.inputs["Base Color"].default_value = (0, 0, 0, 1)
    p.inputs["Roughness"].default_value = 0.08
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = bpy.data.images.load(screen_png)
    nt.links.new(tex.outputs["Color"], p.inputs["Emission Color"])
    p.inputs["Emission Strength"].default_value = 1.35
    p.inputs["Roughness"].default_value = 0.22
    if "Specular IOR Level" in p.inputs:
        p.inputs["Specular IOR Level"].default_value = 0.1
    screen.data.materials.append(sm)
    screen.parent = root

    island = rounded_slab(name + "_island", 0.2, 0.055, 0.002, 0.0275, 8)
    island.location = (0, -D / 2 - 0.005, sh / 2 - 0.06)
    island.data.materials.append(principled("island", "#000000", rough=0.2))
    island.parent = root

    def disc(nm, r, depth, x, y, z, mat, verts=72):
        bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth,
                                            location=(x, y, z), rotation=(math.radians(90), 0, 0))
        o = bpy.context.active_object
        o.name = name + "_" + nm
        o.data.materials.append(mat)
        bv = o.modifiers.new("soft", "BEVEL")
        bv.width = min(0.0025, depth * 0.3)
        bv.segments = 3
        smooth(o, 40)
        o.parent = root
        return o

    back = principled("back_glass_matte", "#121318", metal=0.0, rough=0.55, coat=0.25)
    bp = rounded_slab(name + "_back", W - 0.02, H - 0.02, 0.003, CORNER - 0.01)
    bp.location = (0, D / 2 + 0.0005, 0)
    bp.data.materials.append(back)
    bp.parent = root

    S = 0.37
    cx, cz = W / 2 - 0.045 - S / 2, H / 2 - 0.045 - S / 2
    plate_d = 0.012
    plate = rounded_slab(name + "_cammodule", S, S, plate_d, 0.085, 16)
    plate.location = (cx, D / 2 + plate_d / 2, cz)
    pm = principled("module_glass", "#16171D", metal=0.0, rough=0.18, coat=0.8)
    plate.data.materials.append(pm)
    pb = plate.modifiers.new("edge", "BEVEL")
    pb.limit_method = "ANGLE"
    pb.width = 0.004
    pb.segments = 4
    smooth(plate)
    plate.parent = root

    face = D / 2 + plate_d
    ring_m = principled("lens_ring", "#565A66", metal=1.0, rough=0.16)
    glass_m = principled("lens_glass", "#020205", rough=0.03, coat=1.0)
    iris_m = principled("lens_iris", "#1A2046", metal=0.85, rough=0.14, coat=1.0)
    core_m = principled("lens_core", "#000000", rough=0.02, coat=1.0)
    a, b = 0.088, 0.092
    lenses = ((cx + a, cz + b), (cx + a, cz - b), (cx - a, cz))
    ring_d = 0.03
    for i, (lx, lz) in enumerate(lenses):
        disc("ring%d" % i, 0.07, ring_d, lx, face + ring_d / 2, lz, ring_m)
        disc("glass%d" % i, 0.054, 0.004, lx, face + ring_d + 0.0005, lz, glass_m)
        disc("iris%d" % i, 0.034, 0.002, lx, face + ring_d + 0.0028, lz, iris_m)
        disc("core%d" % i, 0.015, 0.002, lx, face + ring_d + 0.0042, lz, core_m)

    flash_m = principled("flash", "#E8E2D4", rough=0.35, coat=1.0)
    disc("flash", 0.023, 0.003, cx - a, face + 0.0015, cz + 0.128, flash_m)
    disc("lidar", 0.021, 0.003, cx - a, face + 0.0015, cz - 0.128, core_m)
    disc("mic", 0.006, 0.002, cx - 0.01, face + 0.001, cz + 0.152, core_m, 24)

    btn_m = principled("btn", "#2A2C33", metal=1.0, rough=0.32)
    for x, z, h in ((W / 2 + 0.004, 0.24, 0.24),
                    (-W / 2 - 0.004, 0.50, 0.07),
                    (-W / 2 - 0.004, 0.34, 0.12),
                    (-W / 2 - 0.004, 0.18, 0.12)):
        bt = rounded_slab(name + "_btn", 0.012, h, 0.03, 0.0058, 6)
        bt.location = (x, 0, z)
        bt.data.materials.append(btn_m)
        smooth(bt)
        bt.parent = root
    return root


def area(name, loc, rot, size, power, color="#FFFFFF"):
    l = bpy.data.lights.new(name, "AREA")
    l.shape = "RECTANGLE"
    l.size, l.size_y = size
    l.energy = power
    l.color = hexrgb(color)[:3]
    o = bpy.data.objects.new(name, l)
    o.location = loc
    o.rotation_euler = [math.radians(a) for a in rot]
    scene.collection.objects.link(o)
    return o


def setup_render(w, h, transparent, samples=48):
    engines = [i.identifier for i in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items]
    eng = next((e for e in ("BLENDER_EEVEE", "BLENDER_EEVEE_NEXT") if e in engines), engines[0])
    scene.render.engine = eng
    print("engine", eng)
    try:
        scene.eevee.taa_render_samples = samples
    except Exception:
        pass
    for attr in ("use_raytracing",):
        if hasattr(scene.eevee, attr):
            setattr(scene.eevee, attr, True)
    scene.render.resolution_x = w
    scene.render.resolution_y = h
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = transparent
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA" if transparent else "RGB"
    try:
        scene.view_settings.view_transform = "AgX"
        scene.view_settings.look = "AgX - Medium High Contrast"
    except Exception:
        try:
            scene.view_settings.view_transform = "Filmic"
        except Exception:
            pass


def world(color, strength):
    wd = bpy.data.worlds.new("W")
    scene.world = wd
    wd.use_nodes = True
    bg = node(wd, "BACKGROUND")
    bg.inputs["Color"].default_value = hexrgb(color)
    bg.inputs["Strength"].default_value = strength


def camera(loc, target, lens):
    c = bpy.data.cameras.new("Cam")
    c.lens = lens
    c.sensor_fit = "VERTICAL"
    c.sensor_height = 24
    o = bpy.data.objects.new("Cam", c)
    scene.collection.objects.link(o)
    o.location = loc
    t = bpy.data.objects.new("CamTarget", None)
    t.location = target
    scene.collection.objects.link(t)
    con = o.constraints.new("TRACK_TO")
    con.target = t
    con.track_axis = "TRACK_NEGATIVE_Z"
    con.up_axis = "UP_Y"
    scene.camera = o
    return o


def studio_lights():
    area("key", (-2.6, -3.2, 1.6), (70, 0, -38), (2.2, 3.0), 520)
    area("fill", (3.0, -2.6, -0.6), (95, 0, 50), (2.0, 2.0), 160, "#D9D2FF")
    area("rimL", (-2.4, 2.2, 0.8), (-70, 0, -135), (0.6, 3.2), 900, "#FC6381")
    area("rimR", (2.4, 2.2, 0.4), (-70, 0, 135), (0.6, 3.2), 760, "#8CCBFC")
    area("top", (0, -0.5, 3.4), (0, 0, 0), (3.0, 1.2), 300)


os.makedirs(OUT, exist_ok=True)

if MODE in ("preview", "seq"):
    phone = build_phone("Phone", os.path.join(HERE, "splash.png"))
    world("#0F0B26", 0.35)
    studio_lights()
    camera((0, -5.3, 0.1), (0, 0, 0), 66)
    setup_render(900, 1125, True, 48 if MODE == "seq" else 32)

    scene.frame_start, scene.frame_end = 1, 120
    keys = [(1, 0, 0, 0), (30, -10, 0, 70), (60, -16, 4, 180), (90, -8, -3, 290), (120, 0, 0, 360)]
    for f, rx, ry, rz in keys:
        phone.rotation_euler = (math.radians(rx), math.radians(ry), math.radians(rz))
        phone.keyframe_insert("rotation_euler", frame=f)
    if phone.animation_data and phone.animation_data.action:
        act = phone.animation_data.action
        curves = []
        try:
            curves = list(act.fcurves)
        except Exception:
            try:
                for layer in act.layers:
                    for strip in layer.strips:
                        for bag in strip.channelbags:
                            curves += list(bag.fcurves)
            except Exception as e:
                print("fcurve access", e)
        for fc in curves:
            for kp in fc.keyframe_points:
                kp.interpolation = "BEZIER"
                kp.handle_left_type = kp.handle_right_type = "AUTO_CLAMPED"
            if fc.data_path == "rotation_euler" and fc.array_index == 2:
                fc.keyframe_points[0].handle_left_type = fc.keyframe_points[0].handle_right_type = "AUTO_CLAMPED"

    if MODE == "preview":
        for f in (1, 30, 60):
            scene.frame_set(f)
            scene.render.filepath = os.path.join(OUT, "preview_%03d.png" % f)
            bpy.ops.render.render(write_still=True)
    else:
        scene.render.filepath = os.path.join(OUT, "f_")
        bpy.ops.render.render(animation=True)

elif MODE == "duo":
    a = build_phone("PhoneA", os.path.join(HERE, "screen.png"))
    b = build_phone("PhoneB", os.path.join(HERE, "screen2.png"))
    a.location = (-0.62, 0.15, 0.0)
    a.rotation_euler = (math.radians(-4), 0, math.radians(18))
    b.location = (0.62, 0.15, 0.0)
    b.rotation_euler = (math.radians(-4), 0, math.radians(-18))

    bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 0, -0.80))
    floor = bpy.context.active_object
    floor.data.materials.append(principled("floor", "#0E0822", rough=0.42, coat=0.15))

    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 4.5, 1.5), rotation=(math.radians(90), 0, 0))
    wall = bpy.context.active_object
    wall.scale = (30, 14, 1)
    wm = bpy.data.materials.new("sky")
    wm.use_nodes = True
    nt = wm.node_tree
    for n in list(nt.nodes):
        if n.type != "OUTPUT_MATERIAL":
            nt.nodes.remove(n)
    out = node(wm, "OUTPUT_MATERIAL")
    em = nt.nodes.new("ShaderNodeEmission")
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    nt.links.new(tc.outputs["Generated"], sep.inputs[0])
    nt.links.new(sep.outputs["Y"], ramp.inputs["Fac"])
    ramp.color_ramp.elements[0].position = 0.33
    ramp.color_ramp.elements[0].color = hexrgb("#5A2C8C")
    ramp.color_ramp.elements[1].position = 0.56
    ramp.color_ramp.elements[1].color = hexrgb("#0B0620")
    mid = ramp.color_ramp.elements.new(0.41)
    mid.color = hexrgb("#1E0A33")
    nt.links.new(ramp.outputs["Color"], em.inputs["Color"])
    em.inputs["Strength"].default_value = 1.0
    nt.links.new(em.outputs[0], out.inputs["Surface"])
    wall.data.materials.append(wm)

    for m in bpy.data.materials:
        if m.name.startswith("screen_"):
            pn = node(m, "BSDF_PRINCIPLED")
            pn.inputs["Roughness"].default_value = 0.2
            if "Specular IOR Level" in pn.inputs:
                pn.inputs["Specular IOR Level"].default_value = 0.08
    pl = bpy.data.lights.new("starlight", "POINT")
    pl.energy = 140
    pl.color = hexrgb("#F94DA3")[:3]
    po = bpy.data.objects.new("starlight", pl)
    po.location = (0, 0.6, 0.9)
    scene.collection.objects.link(po)

    world("#0B0620", 0.25)
    studio_lights()
    for o in list(scene.objects):
        if o.type == "LIGHT" and o.name in ("rimL", "rimR"):
            o.location.z += 2.2
            o.data.energy *= 0.6
    c = camera((0, -6.2, 0.55), (0, 0, 0.12), 50)
    c.data.sensor_fit = "HORIZONTAL"
    c.data.sensor_width = 36
    setup_render(1920, 1080, False, 64)
    try:
        scene.eevee.use_bloom = True
    except Exception:
        pass
    scene.render.filepath = os.path.join(OUT, "duo.png")
    bpy.ops.render.render(write_still=True)

print("DONE", MODE, OUT)
