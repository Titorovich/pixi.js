import Mesh2d from './Mesh2d';

/**
 * The rope allows you to draw a texture across several points and them manipulate these points
 *
 *```js
 * for (let i = 0; i < 20; i++) {
 *     points.push(new PIXI.Point(i * 50, 0));
 * };
 * let rope = new PIXI.Rope(PIXI.Texture.from("snake.png"), points);
 *  ```
 *
 * @class
 * @extends PIXI.Mesh
 * @memberof PIXI
 *
 */
export default class Rope extends Mesh2d
{
    /**
     * @param {PIXI.Texture} texture - The texture to use on the rope.
     * @param {PIXI.Point[]} points - An array of {@link PIXI.Point} objects to construct this rope.
     */
    constructor(texture, points)
    {
        super(texture, new Float32Array(points.length * 4),
            new Float32Array(points.length * 4),
            new Uint16Array(points.length * 2),
            5);

        /*
         * @member {PIXI.Point[]} An array of points that determine the rope
         */
        this.points = points;
        this.refresh();
    }
    /**
     * Refreshes Rope indices and uvs
     * @private
     */
    _refresh()
    {
        const points = this.points;

        if (!points) return;

        const vertexBuffer = this.geometry.getAttribute('aVertexPosition');
        const uvBuffer = this.geometry.getAttribute('aTextureCoord');
        const indexBuffer = this.geometry.getIndex();

        // if too little points, or texture hasn't got UVs set yet just move on.
        if (points.length < 1 || !this.texture._uvs)
        {
            return;
        }

        // if the number of points has changed we will need to recreate the arraybuffers
        if (vertexBuffer.data.length / 4 !== points.length)
        {
            vertexBuffer.data = new Float32Array(points.length * 4);
            uvBuffer.data = new Float32Array(points.length * 4);
            indexBuffer.data = new Uint16Array(points.length * 2);
        }

        const uvs = uvBuffer.data;
        const indices = indexBuffer.data;

        uvs[0] = 0;
        uvs[1] = 0;
        uvs[2] = 0;
        uvs[3] = 1;

        indices[0] = 0;
        indices[1] = 1;

        const total = points.length;

        for (let i = 1; i < total; i++)
        {
            // time to do some smart drawing!
            let index = i * 4;
            const amount = i / (total - 1);

            uvs[index] = amount;
            uvs[index + 1] = 0;

            uvs[index + 2] = amount;
            uvs[index + 3] = 1;

            index = i * 2;
            indices[index] = index;
            indices[index + 1] = index + 1;
        }

        // ensure that the changes are uploaded
        uvBuffer.update();
        indexBuffer.update();

        this.multiplyUvs();
        this.refreshVertices();
    }

    /**
     * refreshes vertices of Rope mesh
     */
    refreshVertices()
    {
        const points = this.points;

        if (points.length < 1)
        {
            return;
        }

        let lastPoint = points[0];
        let nextPoint;
        let perpX = 0;
        let perpY = 0;

        // this.count -= 0.2;

        const vertices = this.vertices;
        const total = points.length;

        for (let i = 0; i < total; i++)
        {
            const point = points[i];
            const index = i * 4;

            if (i < points.length - 1)
            {
                nextPoint = points[i + 1];
            }
            else
            {
                nextPoint = point;
            }

            perpY = -(nextPoint.x - lastPoint.x);
            perpX = nextPoint.y - lastPoint.y;

            let ratio = (1 - (i / (total - 1))) * 10;

            if (ratio > 1)
            {
                ratio = 1;
            }

            const perpLength = Math.sqrt((perpX * perpX) + (perpY * perpY));
            const num = this._texture.height / 2; // (20 + Math.abs(Math.sin((i + this.count) * 0.3) * 50) )* ratio;

            perpX /= perpLength;
            perpY /= perpLength;

            perpX *= num;
            perpY *= num;

            vertices[index] = point.x + perpX;
            vertices[index + 1] = point.y + perpY;
            vertices[index + 2] = point.x - perpX;
            vertices[index + 3] = point.y - perpY;

            lastPoint = point;
        }

        this.geometry.buffers[0].update();
    }

    /**
     * Updates the object transform for rendering
     *
     * @private
     */
    updateTransform()
    {
        if (this.autoUpdate)
        {
            this.refreshVertices();
        }
        this.containerUpdateTransform();
    }
}
